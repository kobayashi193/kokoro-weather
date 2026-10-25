(() => {
  const list=document.getElementById("list");if(!list)return;
  const client=window.kokoroSupabase;
  const labels={sunny:"快晴",partly:"晴れ",cloudy:"くもり",drizzle:"小雨",storm:"豪雨"};
  const images={sunny:"weather-sunny.png",partly:"weather-partly-cloudy.png",cloudy:"weather-cloudy.png",drizzle:"weather-rain.png",storm:"weather-heavy-rain.png"};
  const weekdays=["日","月","火","水","木","金","土"];
  const pathPrefix=location.protocol==="file:"?"assets/weather/":"";
  async function render(user){
    if(!user)return;
    const [{data:rows,error},{data:memos,error:memoError}]=await Promise.all([
      client.from("weather_records").select("owner_id,record_date,mode,weather,morning,afternoon").order("record_date",{ascending:false}),
      client.from("weather_record_memos").select("record_date,memo,saved_at").eq("owner_id",user.id).order("saved_at")
    ]);
    if(error||memoError){document.getElementById("online-auth-message").textContent="オンラインの記録を読み込めませんでした。";return}
    list.replaceChildren();
    const memoMap={};for(const memo of memos||[])(memoMap[memo.record_date]??=[]).push(memo);
    for(const record of rows||[]){
      const [y,m,d]=record.record_date.split("-").map(Number),date=new Date(y,m-1,d,12);
      const article=document.createElement("article");article.className="entry";
      const head=document.createElement("div");head.className="entry-head";
      const time=document.createElement("time");time.className="date";time.textContent=`${y}年${m}月${d}日（${weekdays[date.getDay()]}）`;
      const owner=document.createElement("span");owner.className="mode";owner.textContent=record.owner_id===user.id?"自分の記録":"共有された天気";head.append(time,owner);article.append(head);
      const row=document.createElement("div");row.className="weather-row";
      const add=(id,part)=>{if(!id)return;const item=document.createElement("span");item.className="weather";if(part){const label=document.createElement("span");label.className="weather-period";label.textContent=part;item.append(label)}const img=document.createElement("img");img.src=pathPrefix+images[id];img.alt=labels[id];item.append(img);row.append(item)};
      if(record.mode==="parts"){add(record.morning,"午前");add(record.afternoon,"午後")}else add(record.weather,"");article.append(row);
      if(record.owner_id===user.id){for(const memo of memoMap[record.record_date]||[]){const note=document.createElement("div");note.className="note-item";const stamp=document.createElement("time");stamp.className="note-time";stamp.textContent=new Date(memo.saved_at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});const text=document.createElement("div");text.className="memo";text.textContent=memo.memo;note.append(stamp,text);article.append(note)}}
      list.append(article);
    }
    if(!(rows||[]).length)list.innerHTML='<div class="empty">まだ記録がありません。</div>';
  }
  client.auth.onAuthStateChange((_event,session)=>render(session?.user||null));
  client.auth.getSession().then(({data})=>render(data.session?.user||null));
})();
