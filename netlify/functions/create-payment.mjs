import { createHash, randomBytes } from "node:crypto";

const INTEGRATION_VERSION = "pagopar-2026-08-12-v11-private-pickup";
const CATALOG = new Map([[1,{name:"Hecho para destacar",price:95000}],[2,{name:"Modo creativo",price:95000}],[3,{name:"Paraguay vibra",price:105000}],[4,{name:"Sin miedo",price:95000}]]);
const SIZES = new Set(["S","M","L","XL","XXL"]);
const COLORS = new Set(["Negro","Blanco"]);
const PRINT_PRICES = {small:25000,medium:30000,large:40000};
const json = (statusCode, body) => ({ statusCode, headers:{"Content-Type":"application/json","Cache-Control":"no-store"}, body:JSON.stringify(body) });
const sha1 = value => createHash("sha1").update(value).digest("hex");
const clean = (value,max=120) => String(value||"").trim().slice(0,max);
const normalized = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

export async function handler(event) {
  if (event.httpMethod === "GET") return json(200,{ok:true,version:INTEGRATION_VERSION});
  if (event.httpMethod !== "POST") return json(405,{error:"Método no permitido."});
  const publicKey=process.env.PAGOPAR_PUBLIC_KEY, privateKey=process.env.PAGOPAR_PRIVATE_KEY;
  if(!publicKey||!privateKey) return json(503,{error:"Pagopar todavía no está configurado. Agregá las claves del comercio en Netlify."});
  const sellerAddress=clean(process.env.SELLER_ADDRESS,180), sellerReference=clean(process.env.SELLER_REFERENCE,120), sellerPhone=clean(process.env.SELLER_PHONE,30), sellerCityName=clean(process.env.SELLER_CITY||"Encarnacion",80);
  if(!sellerAddress||!sellerPhone) return json(503,{error:"Falta configurar la dirección privada de retiro en Netlify."});
  try {
    const {customer={},items=[]}=JSON.parse(event.body||"{}");
    const name=clean(customer.name), email=clean(customer.email), document=clean(customer.document,20).replace(/[^0-9-]/g,""), phone=clean(customer.phone,30).replace(/[^+0-9]/g,""), address=clean(customer.address,180), cityName=clean(customer.city,80);
    if(name.length<3||!email.includes("@")||document.length<5||phone.length<8||!address||!cityName) return json(400,{error:"Revisá los datos personales y la dirección."});
    const citiesResponse=await fetch("https://api.pagopar.com/api/ciudades/1.1/traer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:sha1(`${privateKey}CIUDADES`),token_publico:publicKey})});
    const citiesResult=await citiesResponse.json(), cities=Array.isArray(citiesResult?.resultado)?citiesResult.resultado:[];
    const cityIdFor=value=>cities.find(city=>normalized(city.descripcion)===normalized(value))?.ciudad;
    const buyerCityId=cityIdFor(cityName), sellerCityId=cityIdFor(sellerCityName);
    if(!buyerCityId)return json(400,{error:`Pagopar no reconoce la ciudad de entrega: ${cityName}.`});
    if(!sellerCityId)return json(503,{error:`Pagopar no reconoce la ciudad de retiro configurada: ${sellerCityName}.`});
    if(!Array.isArray(items)||!items.length||items.length>20) return json(400,{error:"El carrito no es válido."});
    const validated=items.map(item=>{const qty=Number(item.qty),id=Number(item.id);if(!Number.isInteger(qty)||qty<1||qty>10||!SIZES.has(item.size)||!COLORS.has(item.color))throw new Error("El carrito contiene una variante no válida.");if(id===100){const printSize=item.custom?.printSize,back=item.custom?.back===true;if(!PRINT_PRICES[printSize])throw new Error("El tamaño de impresión no es válido.");return{name:"Remera personalizada",price:55000+PRINT_PRICES[printSize]+(back?20000:0)+(item.size==="XXL"?5000:0),id,qty,size:item.size,color:item.color,custom:{printSize,side:item.custom?.side==="Espalda"?"Espalda":"Frente",back,text:clean(item.custom?.text,28),hasImage:item.custom?.hasImage===true}};}const product=CATALOG.get(id);if(!product)throw new Error("El producto no es válido.");return{...product,id,qty,size:item.size,color:item.color};});
    const shipping=Number(process.env.SHIPPING_PRICE||25000), productsTotal=validated.reduce((sum,item)=>sum+item.price*item.qty,0), total=productsTotal+shipping;
    const orderId=`TRZ-${Date.now()}-${randomBytes(2).toString("hex").toUpperCase()}`;
    const expires=new Date(Date.now()+24*60*60*1000),date=expires.toLocaleString("sv-SE",{timeZone:"America/Asuncion"}).replace("T"," ").slice(0,19);
    const packageData={peso:"0.30",largo:"30.00",ancho:"25.00",alto:"3.00",opciones_envio:{}};
    const purchaseItems=validated.map(item=>({ciudad:sellerCityId,nombre:`${item.name} — ${item.color} / ${item.size}`,cantidad:item.qty,categoria:"979",...packageData,public_key:publicKey,url_imagen:"",descripcion:item.custom?`DTF ${item.custom.printSize}, ${item.custom.side}${item.custom.back?", más espalda":""}${item.custom.text?`, texto: ${item.custom.text}`:""}${item.custom.hasImage?", incluye imagen":""}`:`Remera DTF ${item.color}, talle ${item.size}`,id_producto:item.id,precio_total:item.price*item.qty,vendedor_telefono:sellerPhone.startsWith("+")?sellerPhone:`+595${sellerPhone.replace(/^0/,"")}`,vendedor_direccion:sellerAddress,vendedor_direccion_referencia:sellerReference,vendedor_direccion_coordenadas:""}));
    const buyer={ruc:"",email,ciudad:buyerCityId,nombre:name,telefono:phone.startsWith("+")?phone:`+595${phone.replace(/^0/,"")}`,direccion:address,documento:document,coordenadas:"",razon_social:"",tipo_documento:"CI",direccion_referencia:""};
    const freightPayload={token:sha1(`${privateKey}CALCULAR-FLETE`),comprador:buyer,public_key:publicKey,monto_total:productsTotal,tipo_pedido:"VENTA-COMERCIO",compras_items:purchaseItems,fecha_maxima_pago:date,id_pedido_comercio:orderId,descripcion_resumen:`Pedido ${orderId}`,forma_pago:9};
    const freightResponse=await fetch("https://api.pagopar.com/api/calcular-flete/2.0/traer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(freightPayload)});
    const freight=await freightResponse.json();
    if(!freightResponse.ok||freight?.respuesta===false||!Array.isArray(freight?.compras_items))return json(502,{error:typeof freight?.resultado==="string"?freight.resultado:"Pagopar no pudo calcular el envío propio."});
    let aexShipping=0;
    freight.compras_items.forEach(item=>{const aex=item.opciones_envio?.metodo_aex;const standard=aex?.opciones?.find(option=>option.id==="3-0")||aex?.opciones?.[0];if(!standard)throw new Error("AEX no ofreció una opción de envío para este pedido.");aex.id=standard.id;aex.costo=standard.costo;aex.tiempo_entrega=standard.tiempo_entrega;item.envio_seleccionado="aex";item.costo_envio=Number(standard.costo)||0;aexShipping+=item.costo_envio;});
    freight.monto_total=productsTotal+aexShipping;
    freight.token=sha1(`${privateKey}CALCULAR-FLETE`);
    const selectedResponse=await fetch("https://api.pagopar.com/api/calcular-flete/2.0/traer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(freight)});
    const selected=await selectedResponse.json();
    if(!selectedResponse.ok||selected?.respuesta===false||!Array.isArray(selected?.compras_items))return json(502,{error:typeof selected?.resultado==="string"?selected.resultado:"Pagopar no pudo confirmar el envío propio."});
    const finalTotal=Number(selected.monto_total)||freight.monto_total;
    const payload={...selected,token:sha1(`${privateKey}${orderId}${finalTotal}`),monto_total:finalTotal};
    const response=await fetch("https://api.pagopar.com/api/comercios/2.0/iniciar-transaccion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json(),hash=result?.resultado?.[0]?.data;
    if(!response.ok||!result?.respuesta||!hash)return json(502,{error:typeof result?.resultado==="string"?result.resultado:"Pagopar no pudo crear el pedido."});
    return json(200,{orderId,hash,checkoutUrl:`https://www.pagopar.com/pagos/${encodeURIComponent(hash)}`});
  } catch(error){return json(400,{error:error.message||"No pudimos procesar el pedido."});}
}
