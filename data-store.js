
(function(){
  const LOCAL_KEY = "fujinomiya_spots_v3";
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
    return {
      id: s.id || ("local-" + Date.now() + "-" + i),
      name: s.name || "",
      genre: s.genre || "",
      area: s.area || "",
      address: s.address || "",
      phone: s.phone || "",
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
    const seed = (window.DEFAULT_SPOTS || []).map(normalize);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(seed));
    return seed;
  }

  function localSave(list){
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.map(normalize)));
  }

  async function list({includeInactive=false}={}){
    const sb = getClient();
    if(!sb){
      return localLoad()
        .filter(s => includeInactive || s.active)
        .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    }
    let q = sb.from("spots").select("*").order("sort_order",{ascending:true}).order("name",{ascending:true});
    if(!includeInactive) q = q.eq("active", true);
    const {data,error} = await q;
    if(error) throw error;
    return (data || []).map(normalize);
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
    const payload = {
      name:s.name, genre:s.genre, area:s.area, address:s.address, phone:s.phone,
      homepage:s.homepage, description:s.description, image_url:s.image_url,
      lat:s.lat, lng:s.lng, sort_order:s.sort_order, active:s.active
    };
    if(s.id && !String(s.id).startsWith("local-") && !String(s.id).startsWith("seed-")){
      payload.id = s.id;
    }
    const {data,error} = await sb.from("spots").upsert(payload).select().single();
    if(error) throw error;
    return normalize(data);
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

    // Local mode: resize and store as data URL.
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

  async function seedCloud(){
    const sb = getClient();
    if(!sb) throw new Error("クラウドモードではありません");
    const rows = (window.DEFAULT_SPOTS||[]).map((s,i)=>({
      name:s.name, genre:s.genre, area:s.area, address:s.address, phone:s.phone,
      homepage:s.homepage, description:s.description, image_url:s.image_url,
      lat:s.lat, lng:s.lng, sort_order:s.sort_order ?? i+1, active:s.active !== false
    }));
    const {data,error} = await sb.from("spots").insert(rows).select();
    if(error) throw error;
    return data;
  }

  window.SpotStore = {
    cloudConfigured,getClient,list,upsert,remove,uploadImage,
    getSession,login,logout,isAdmin,seedCloud,
    resetLocal(){
      localStorage.removeItem(LOCAL_KEY);
      return localLoad();
    }
  };
})();
