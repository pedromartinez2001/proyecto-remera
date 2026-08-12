import { createHash, randomBytes } from "node:crypto";

const INTEGRATION_VERSION = "pagopar-2026-08-12-v2";
const CATALOG = new Map([[1,{name:"Hecho para destacar",price:95000}],[2,{name:"Modo creativo",price:95000}],[3,{name:"Paraguay vibra",price:105000}],[4,{name:"Sin miedo",price:95000}]]);
const SIZES = new Set(["S","M","L","XL","XXL"]);
const COLORS = new Set(["Negro","Blanco"]);
const PRINT_PRICES = {small:25000,medium:30000,large:40000};
const json = (statusCode, body) => ({ statusCode, headers:{"Content-Type":"application/json","Cache-Control":"no-store"}, body:JSON.stringify(body) });
const sha1 = value => createHash("sha1").update(value).digest("hex");
const clean = (value,max=120) => String(value||"").trim().slice(0,max);

export async function handler(event) {
  if (event.httpMethod === "GET") return json(200,{ok:true,version:INTEGRATION_VERSION});
  if (event.httpMethod !== "POST") return json(405,{error:"Método no permitido."});
  const publicKey=process.env.PAGOPAR_PUBLIC_KEY, privateKey=process.env.PAGOPAR_PRIVATE_KEY;
  if(!publicKey||!privateKey) return json(503,{error:"Pagopar todavía no está configurado. Agregá las claves del comercio en Netlify."});
  try {
    const {customer={},items=[]}=JSON.parse(event.body||"{}");
    const name=clean(customer.name), email=clean(customer.email), document=clean(customer.document,20).replace(/[^0-9-]/g,""), phone=clean(customer.phone,30).replace(/[^+0-9]/g,""), address=clean(customer.address,180), cityName=clean(customer.city,80);
    if(name.length<3||!email.includes("@")||document.length<5||phone.length<8||!address||!cityName) return json(400,{error:"Revisá los datos personales y la dirección."});
    if(!Array.isArray(items)||!items.length||items.length>20) return json(400,{error:"El carrito no es válido."});
    const validated=items.map(item=>{const qty=Number(item.qty),id=Number(item.id);if(!Number.isInteger(qty)||qty<1||qty>10||!SIZES.has(item.size)||!COLORS.has(item.color))throw new Error("El carrito contiene una variante no válida.");if(id===100){const printSize=item.custom?.printSize,back=item.custom?.back===true;if(!PRINT_PRICES[printSize])throw new Error("El tamaño de impresión no es válido.");return{name:"Remera personalizada",price:55000+PRINT_PRICES[printSize]+(back?20000:0)+(item.size==="XXL"?5000:0),id,qty,size:item.size,color:item.color,custom:{printSize,side:item.custom?.side==="Espalda"?"Espalda":"Frente",back,text:clean(item.custom?.text,28),hasImage:item.custom?.hasImage===true}};}const product=CATALOG.get(id);if(!product)throw new Error("El producto no es válido.");return{...product,id,qty,size:item.size,color:item.color};});
    const shipping=Number(process.env.SHIPPING_PRICE||25000), productsTotal=validated.reduce((sum,item)=>sum+item.price*item.qty,0), total=productsTotal+shipping;
    const orderId=`TRZ-${Date.now()}-${randomBytes(2).toString("hex").toUpperCase()}`;
    const expires=new Date(Date.now()+24*60*60*1000),date=expires.toLocaleString("sv-SE",{timeZone:"America/Asuncion"}).replace("T"," ").slice(0,19);
    const purchaseItems=validated.map(item=>({ciudad:"1",nombre:`${item.name} — ${item.color} / ${item.size}`,cantidad:item.qty,categoria:"909",public_key:publicKey,url_imagen:"",descripcion:item.custom?`DTF ${item.custom.printSize}, ${item.custom.side}${item.custom.back?", más espalda":""}${item.custom.text?`, texto: ${item.custom.text}`:""}${item.custom.hasImage?", incluye imagen":""}`:`Remera DTF ${item.color}, talle ${item.size}`,id_producto:item.id,precio_total:item.price*item.qty,vendedor_telefono:"",vendedor_direccion:"",vendedor_direccion_referencia:"",vendedor_direccion_coordenadas:""}));
    if(shipping>0)purchaseItems.push({ciudad:"1",nombre:"Envío nacional",cantidad:1,categoria:"909",public_key:publicKey,url_imagen:"",descripcion:`Entrega en ${cityName}`,id_producto:9001,precio_total:shipping,vendedor_telefono:"",vendedor_direccion:"",vendedor_direccion_referencia:"",vendedor_direccion_coordenadas:""});
    const payload={token:sha1(`${privateKey}${orderId}${Number(total)}`),comprador:{ruc:"",email,ciudad:"1",nombre:name,telefono:phone.startsWith("+")?phone:`+595${phone.replace(/^0/,"")}`,direccion:`${address}, ${cityName}`,documento,coordenadas:"",razon_social:"",tipo_documento:"CI",direccion_referencia:""},public_key:publicKey,monto_total:total,tipo_pedido:"VENTA-COMERCIO",compras_items:purchaseItems,fecha_maxima_pago:date,id_pedido_comercio:orderId,descripcion_resumen:`Pedido ${orderId}`,forma_pago:9};
    const response=await fetch("https://api.pagopar.com/api/comercios/2.0/iniciar-transaccion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json(),hash=result?.resultado?.[0]?.data;
    if(!response.ok||!result?.respuesta||!hash)return json(502,{error:typeof result?.resultado==="string"?result.resultado:"Pagopar no pudo crear el pedido."});
    return json(200,{orderId,hash,checkoutUrl:`https://www.pagopar.com/pagos/${encodeURIComponent(hash)}`});
  } catch(error){return json(400,{error:error.message||"No pudimos procesar el pedido."});}
}
