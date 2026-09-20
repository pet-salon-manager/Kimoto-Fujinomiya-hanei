(function(){
  const LOCAL_KEY = "fujinomiya_spots_v4";
  let client = null;

  function cloudConfigured(){
    const c = window.APP_CONFIG || {};
    return !!(c.supabaseUrl && c.supabaseAnonKey && window.supabase);
  }

  function getClient(){
    if(!cloudConfigured()) return null;
    if(!client){
      client = window.supabase.createClient(
        window.APP_CONFIG.supabaseUrl,
        window.APP_CONFIG.supabaseAnonKey
      );
    }
    return client;
  }

  function normalize(s, i=0){
    const phoneEntries=[];
    if(s.phone_note || s.phone2 || s.phone2_note){
      if(s.phone || s.phone_note) phoneEntries.push({number:s.phone||"",note:s.phone_note||""});
      if(s.phone2 || s.phone2_note) phoneEntries.push({number:s.phone2||"",note:s.phone2_note||""});
    }
    return {
      id: s.id || ("local-" + Date.now() + "-" + i),
      source_key: s.source_key || "",
      place_type: s.place_type || "attraction",
      name: s.name || "",
      genre: s.genre || "",
      area: s.area || "",
      address: s.address || "",
      address_note: s.address_note || "",
      phone: s.phone || "",
      phone_note: s.phone_note || "",
      phone2: s.phone2 || "",
      phone2_note: s.phone2_note || "",
      phone_entries: phoneEntries,
      homepage: s.homepage || "",
      description: s.description ?? s.feature ?? "",
      image_url: s.image_url || "",
      lat: s.lat === "" || s.lat == null ? null : Number(s.lat),
      lng: s.lng === "" || s.lng == null ? null : Number(s.lng),
      sort_order: Number.isFinite(Number(s.sort_order)) ? Number(s.sort_order) : i + 1,
      active: s.active !== false
    };
  }

  function localLoad(){
    try{
      const raw = localStorage.getItem(LOCAL_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(Array.isArray(parsed)) return parsed.map(normalize);
      }
    }catch(e){}
    const seed = (window.DEFAULT_SPOTS || []).map((s,i)=>normalize({...s,place_type:"attraction"},i));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(seed));
    return seed;
  }

  function localSave(list){
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.map(normalize)));
  }

  async function list({includeInactive=false,placeType=null}={}){
    const sb = getClient();
    if(!sb){
      return localLoad()
        .filter(s => !placeType || s.place_type===placeType)
        .filter(s => includeInactive || s.active)
        .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0) || String(a.name).localeCompare(String(b.name),"ja"));
    }
    let q = sb.from("spots").select("*").order("sort_order",{ascending:true}).order("name",{ascending:true});
    if(placeType) q = q.eq("place_type",placeType);
    if(!includeInactive) q = q.eq("active", true);
    const {data,error} = await q;
    if(error) throw error;
    return (data || []).map(normalize);
  }

  function uuidLike(v){
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""));
  }


  function stableUuidFromString(value){
    const s=String(value||"");
    // Deterministic 128-bit-ish hash constructed from four 32-bit FNV-style lanes.
    let h1=0x811c9dc5, h2=0x811c9dc5, h3=0x811c9dc5, h4=0x811c9dc5;
    for(let i=0;i<s.length;i++){
      const c=s.charCodeAt(i);
      h1=Math.imul(h1^c,0x01000193)>>>0;
      h2=Math.imul(h2^(c+i),0x01000193)>>>0;
      h3=Math.imul(h3^(c+(i<<1)),0x01000193)>>>0;
      h4=Math.imul(h4^(c+(i<<2)),0x01000193)>>>0;
    }
    const hex=n=>n.toString(16).padStart(8,"0");
    let raw=(hex(h1)+hex(h2)+hex(h3)+hex(h4)).slice(0,32).split("");
    // RFC 4122 version 4 / variant bits so Postgres UUID accepts it normally.
    raw[12]="4";
    const variants=["8","9","a","b"];
    raw[16]=variants[parseInt(raw[16],16)%4];
    const x=raw.join("");
    return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20,32)}`;
  }

  function newUuid(){
    if(globalThis.crypto && typeof globalThis.crypto.randomUUID==="function"){
      return globalThis.crypto.randomUUID();
    }
    return stableUuidFromString(`${Date.now()}-${Math.random()}-${Math.random()}`);
  }

  function payloadFrom(s){
    const n=normalize(s);
    let id;
    if(uuidLike(n.id)){
      id=n.id;
    }else if(n.source_key){
      // Same source_key always receives the same UUID, so retrying migration does not duplicate rows.
      id=stableUuidFromString(n.source_key);
    }else{
      id=newUuid();
    }

    return {
      id,
      source_key:n.source_key || null,
      place_type:n.place_type || "attraction",
      name:n.name, genre:n.genre, area:n.area,
      address:n.address, address_note:n.address_note,
      phone:n.phone, phone_note:n.phone_note,
      phone2:n.phone2, phone2_note:n.phone2_note,
      homepage:n.homepage, description:n.description, image_url:n.image_url,
      lat:n.lat, lng:n.lng, sort_order:n.sort_order, active:n.active
    };
  }

  async function upsert(spot){
    const s = normalize(spot);
    const sb = getClient();
    if(!sb){
      const list = localLoad();
      const ix = list.findIndex(x=>x.id===s.id);
      if(ix >= 0) list[ix] = s;
      else list.push(s);
      localSave(list);
      return s;
    }
    const payload=payloadFrom(s);
    const {data,error} = await sb.from("spots").upsert(payload).select().single();
    if(error) throw error;
    return normalize(data);
  }

  async function bulkUpsert(rows,{chunkSize=100,onProgress=null}={}){
    const sb=getClient();
    if(!sb){
      const list=localLoad();
      rows.map(normalize).forEach(s=>{
        const ix=list.findIndex(x=>x.id===s.id || (s.source_key && x.source_key===s.source_key));
        if(ix>=0) list[ix]=s; else list.push(s);
      });
      localSave(list);
      return {count:rows.length};
    }
    let done=0;
    for(let i=0;i<rows.length;i+=chunkSize){
      const chunk=rows.slice(i,i+chunkSize).map(payloadFrom);
      const {error}=await sb.from("spots").upsert(chunk,{defaultToNull:false});
      if(error) throw error;
      done+=chunk.length;
      if(onProgress) onProgress(done,rows.length);
    }
    return {count:done};
  }

  async function hasSeededType(placeType){
    const sb=getClient();
    if(!sb) return false;
    const {data,error}=await sb
      .from("spots")
      .select("id")
      .eq("place_type",placeType)
      .not("source_key","is",null)
      .limit(1);
    if(error) throw error;
    return !!(data && data.length);
  }

  async function remove(id){
    const sb = getClient();
    if(!sb){
      localSave(localLoad().filter(s=>s.id!==id));
      return;
    }
    const {error} = await sb.from("spots").delete().eq("id", id);
    if(error) throw error;
  }

  async function uploadImage(file, currentUrl=""){
    if(!file) return currentUrl || "";
    const sb = getClient();

    if(!sb){
      return await new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = ()=>{
          const image = new Image();
          image.onload = ()=>{
            const max = 1200;
            const scale = Math.min(1, max/Math.max(image.width,image.height));
            const w = Math.max(1, Math.round(image.width*scale));
            const h = Math.max(1, Math.round(image.height*scale));
            const canvas = document.createElement("canvas");
            canvas.width=w; canvas.height=h;
            canvas.getContext("2d").drawImage(image,0,0,w,h);
            resolve(canvas.toDataURL("image/jpeg",0.76));
          };
          image.onerror = reject;
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext || "jpg"}`;
    const {error} = await sb.storage.from("spot-images").upload(path,file,{upsert:false});
    if(error) throw error;
    const {data} = sb.storage.from("spot-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function getSession(){
    const sb = getClient();
    if(!sb) return null;
    const {data} = await sb.auth.getSession();
    return data.session || null;
  }

  async function login(email,password){
    const sb = getClient();
    if(!sb) throw new Error("Supabaseが未設定です");
    const {data,error} = await sb.auth.signInWithPassword({email,password});
    if(error) throw error;
    return data.session;
  }

  async function logout(){
    const sb = getClient();
    if(sb) await sb.auth.signOut();
  }

  async function isAdmin(){
    const sb = getClient();
    if(!sb) return true;
    const session = await getSession();
    if(!session) return false;
    const {data,error} = await sb.from("admin_users").select("user_id").eq("user_id",session.user.id).maybeSingle();
    if(error) throw error;
    return !!data;
  }

  window.SpotStore = {
    cloudConfigured,getClient,list,upsert,bulkUpsert,hasSeededType,remove,uploadImage,
    getSession,login,logout,isAdmin,
    resetLocal(){
      localStorage.removeItem(LOCAL_KEY);
      return localLoad();
    }
  };
})();
