(() => {
  const people = document.getElementById("people");
  if (!people) return;
  const client = window.kokoroSupabase;
  const scopeNames = {from_today:"今日から",past_7_days:"過去7日",past_30_days:"過去30日",all_past:"すべての過去"};
  const modal = document.getElementById("modal");
  const scopeLabel = document.createElement("label");
  scopeLabel.className = "scope";
  scopeLabel.innerHTML = '見せる期間<select id="invite-scope"><option value="from_today">今日から</option><option value="past_7_days">過去7日</option><option value="past_30_days" selected>過去30日</option><option value="all_past">すべての過去</option></select>';
  modal.querySelector(".actions").before(scopeLabel);
  const render = async (user) => {
    people.replaceChildren();
    if (!user) return;
    const {data,error} = await client.from("share_grants").select("id,recipient_email,scope,starts_on").eq("owner_id",user.id).is("revoked_at",null).order("created_at");
    if (error) { toast("共有設定を読み込めませんでした。"); return; }
    for (const grant of data || []) {
      const row = document.createElement("div");
      row.className = "person";
      const avatar = document.createElement("div"); avatar.className = "avatar"; avatar.textContent = grant.recipient_email.slice(0,1).toUpperCase();
      const details = document.createElement("div"); details.className = "details";
      const name = document.createElement("strong"); name.textContent = grant.recipient_email.split("@")[0];
      const email = document.createElement("small"); email.textContent = grant.recipient_email; details.append(name,email);
      const label = document.createElement("label"); label.className = "scope"; label.append("見せる期間");
      const select = document.createElement("select");
      Object.entries(scopeNames).forEach(([value,title])=>{const option=document.createElement("option");option.value=value;option.textContent=title;option.selected=grant.scope===value;select.append(option)});
      select.addEventListener("change",async()=>{const {error}=await client.from("share_grants").update({scope:select.value}).eq("id",grant.id);if(error)toast("期間を変更できませんでした。");else toast("見せる期間を変更しました。");});
      label.append(select);
      const remove = document.createElement("button");remove.className="remove";remove.type="button";remove.textContent="×";remove.setAttribute("aria-label",email.textContent+"との共有を解除");
      remove.addEventListener("click",async()=>{const {error}=await client.from("share_grants").update({revoked_at:new Date().toISOString()}).eq("id",grant.id);if(error)toast("共有を解除できませんでした。");else{row.remove();toast("共有を解除しました。")}});
      row.append(avatar,details,label,remove);people.appendChild(row);
    }
  };
  document.addEventListener("click",async(event)=>{
    if (!event.target.closest("#send")) return;
    event.preventDefault();event.stopImmediatePropagation();
    const user=window.kokoroCurrentUser;
    if(!user){toast("共有するには先にメールでログインしてください。");modal.classList.remove("show");return}
    const input=document.getElementById("email"),email=input.value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){input.focus();return}
    const scope=document.getElementById("invite-scope").value;
    const {error}=await client.from("share_grants").insert({owner_id:user.id,recipient_email:email,scope});
    if(error){toast("共有設定を保存できませんでした。SQL設定を確認してください。");return}
    input.value="";modal.classList.remove("show");toast("共有を設定しました。相手は同じメールでログインすると見られます。");render(user);
  },true);
  client.auth.onAuthStateChange((_event,session)=>render(session?.user||null));
  client.auth.getSession().then(({data})=>render(data.session?.user||null));
})();
