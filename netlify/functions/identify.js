// Proxy seguro: la API key vive en la variable de entorno ANTHROPIC_API_KEY (nunca en el navegador).
const SYSTEM=`Eres una botánica experta. Analiza la foto y responde SOLO con un objeto JSON válido (sin texto extra ni markdown), en español, con estos campos:
{"es_planta":boolean,"nombre_comun":string,"nombre_cientifico":string,"confianza":number entre 0 y 1,"estado":"sana"|"atencion"|"enferma","problema":string (vacío si sana),
"cuidados":{"riego":string,"luz":string,"sustrato":string,"temperatura":string,"fertilizacion":string},
"toxica":{"mascotas":"sí"|"no"|"desconocido","ninos":"sí"|"no"|"desconocido","detalle":string},"tratamiento":string (vacío si sana),"nota":string}
Si la imagen no contiene una planta, devuelve es_planta=false y explica en "nota"; no inventes especies. Sé honesto con la confianza.`;
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return{statusCode:405,body:'Method not allowed'};
  try{
    const {image,mediaType='image/jpeg'}=JSON.parse(event.body||'{}');
    if(!image||image.length>6e6)return{statusCode:400,body:'Imagen inválida'};
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
      headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-sonnet-5-5',max_tokens:1200,system:SYSTEM,messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:mediaType,data:image}},{type:'text',text:'Identifica esta planta y evalúa su salud.'}]}]})});
    if(!r.ok)return{statusCode:r.status===429?429:502,body:'Error del proveedor'};
    const j=await r.json();const t=(j.content||[]).map(c=>c.text||'').join('').replace(/```json|```/g,'').trim();
    JSON.parse(t);
    return{statusCode:200,headers:{'content-type':'application/json'},body:t};
  }catch(e){return{statusCode:500,body:'Error'}}
};
