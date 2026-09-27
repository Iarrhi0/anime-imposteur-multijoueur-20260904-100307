function cors(origin, allowedOrigin){
  const allow = allowedOrigin && origin===allowedOrigin ? origin : (allowedOrigin ? allowedOrigin : origin || "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env) {
    const origin=request.headers.get("Origin")||"";
    const headers=cors(origin,env.APP_ORIGIN||"");

    if(request.method==="OPTIONS"){
      return new Response(null,{status:204,headers});
    }
    if(request.method!=="GET"){
      return new Response("Method not allowed",{status:405,headers});
    }
    if(env.APP_ORIGIN && origin!==env.APP_ORIGIN){
      return new Response("Origin denied",{status:403,headers});
    }

    const auth=request.headers.get("Authorization")||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    if(!token)return new Response("Unauthorized",{status:401,headers});

    const verify=await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({idToken:token})
      }
    );

    if(!verify.ok){
      return new Response("Invalid Firebase token",{status:401,headers});
    }

    const identity=await verify.json();
    const uid=identity?.users?.[0]?.localId;
    if(!uid)return new Response("Invalid Firebase user",{status:401,headers});

    const turn=await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method:"POST",
        headers:{
          "Authorization":`Bearer ${env.TURN_KEY_API_TOKEN}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({ttl:3600,customIdentifier:uid})
      }
    );

    const body=await turn.text();
    return new Response(body,{
      status:turn.status,
      headers:{...headers,"Content-Type":"application/json","Cache-Control":"no-store"}
    });
  }
};
