(() => {
  const config = window.KOKORO_SUPABASE_CONFIG;
  if (!config || !window.supabase?.createClient) return;
  const client = window.kokoroSupabase = window.supabase.createClient(config.url, config.publishableKey);
  const authPanel = document.createElement("section");
  authPanel.className = "online-auth";
  authPanel.innerHTML = '<div class="online-auth-copy"><strong>記録をオンラインに保存</strong><span id="online-auth-status">ログインすると、ほかの端末からも記録を見られます。</span></div><form id="online-login"><label for="online-email">メールアドレス</label><input id="online-email" type="email" autocomplete="email" required placeholder="メールアドレス"><button type="submit">ログインリンクを送る</button></form><div id="online-user" hidden><span id="online-user-email"></span><button id="online-logout" type="button">ログアウト</button></div><p id="online-auth-message" role="status" aria-live="polite"></p>';
  const layoutStyle = document.createElement("style");
  layoutStyle.textContent = '.online-auth{display:flex;align-items:center;gap:18px;margin:32px 0 0;padding:13px 16px;border:1px solid #E5EAED;border-radius:11px;background:#fff}.online-auth.home-auth{max-width:790px;width:100%;margin:32px auto 0}.online-auth-copy{display:grid;gap:2px;min-width:180px}.online-auth-copy strong{font-size:12px}.online-auth-copy span,#online-auth-message{color:#7C8794;font-size:11px}.online-auth form{display:flex;align-items:center;gap:8px;margin:0}.online-auth label{color:#7C8794;font-size:11px}.online-auth input{width:210px;padding:9px 11px;border:1px solid #D8DEE4;border-radius:8px;font:inherit;font-size:12px}.online-auth button{border:0;border-radius:8px;padding:9px 13px;background:#FFE45B;color:#172E4B;font:inherit;font-size:12px;font-weight:800;cursor:pointer}#online-user{display:flex;align-items:center;gap:12px;margin-left:auto;font-size:12px}#online-auth-message{margin:0 0 0 auto}.online-auth [hidden]{display:none!important}.online-nav{justify-content:flex-end;margin:0 0 20px}@media(max-width:760px){.online-auth{align-items:flex-start;flex-direction:column;gap:8px}.online-auth form{flex-wrap:wrap}.online-auth input{width:min(240px,60vw)}#online-user,#online-auth-message{margin:0}.online-nav{justify-content:center;margin-bottom:16px}}';
  document.head.appendChild(layoutStyle);
  const app = document.querySelector("main.app");
  if (app) {
    if (app.querySelector(".hero")) {
      authPanel.classList.add("home-auth");
      const footer = app.querySelector(".footer");
      if (footer) footer.insertAdjacentElement("beforebegin", authPanel);
      else app.appendChild(authPanel);
    } else {
      app.appendChild(authPanel);
    }
  }
  const status = document.getElementById("online-auth-status");
  const login = document.getElementById("online-login");
  const signedIn = document.getElementById("online-user");
  const message = document.getElementById("online-auth-message");
  let currentUser = null;
  let syncingUser = null;
  const localKey = "kokoro-weather-records-v1";
  const ownerKey = localKey + "-owner";
  const isRecordPage = location.pathname.endsWith("mood-weather-sharing.html");
  const setMessage = (text) => { if (message) message.textContent = text; };
  const setSession = (session) => {
    currentUser = session?.user || null;
      window.kokoroCurrentUser = currentUser;
    if (!login || !signedIn) return;
    login.hidden = !!currentUser;
    signedIn.hidden = !currentUser;
    if (currentUser) {
      document.getElementById("online-user-email").textContent = currentUser.email || "ログイン中";
      status.textContent = "このブラウザーの記録をオンラインに保存しています。";
      if (isRecordPage) syncCloudRecords(currentUser);
    } else {
      status.textContent = "ログインすると、ほかの端末からも記録を見られます。";
    }
  };
  async function syncCloudRecords(user) {
    if (syncingUser === user.id) return;
    syncingUser = user.id;
    try {
      let local = {};
      try { local = JSON.parse(localStorage.getItem(localKey) || "{}") || {}; } catch (_) {}
      const previousOwner = localStorage.getItem(ownerKey);
      if (!previousOwner) {
        const {data:existingRows,error:existingError}=await client.from("weather_records").select("record_date").eq("owner_id",user.id);
        if(existingError)throw existingError;
        const existingDates=new Set((existingRows||[]).map((row)=>row.record_date));
        for (const [date, record] of Object.entries(local)) {
          if(!existingDates.has(date)) {
            const weatherRow = {owner_id:user.id, record_date:date, mode:record.mode, weather:record.weather || null, morning:record.morning || null, afternoon:record.afternoon || null, updated_at:record.savedAt || new Date().toISOString()};
            const {error} = await client.from("weather_records").insert(weatherRow);
            if (error) throw error;
          }
          const entries = Array.isArray(record.entries) ? record.entries : (record.memo ? [{memo:record.memo, savedAt:record.savedAt}] : []);
          for (const entry of entries) {
            if (!entry.memo) continue;
            const {error:memoError} = await client.from("weather_record_memos").upsert({owner_id:user.id,record_date:date,memo:entry.memo,saved_at:entry.savedAt || new Date().toISOString()}, {onConflict:"owner_id,record_date,saved_at"});
            if (memoError) throw memoError;
          }
        }
        localStorage.setItem(ownerKey, user.id);
      }
      const [{data:weatherRows,error:weatherError},{data:memoRows,error:memoError}] = await Promise.all([
        client.from("weather_records").select("owner_id,record_date,mode,weather,morning,afternoon,updated_at").eq("owner_id",user.id),
        client.from("weather_record_memos").select("record_date,memo,saved_at").eq("owner_id",user.id).order("saved_at")
      ]);
      if (weatherError) throw weatherError;
      if (memoError) throw memoError;
      const cloud = {};
      for (const row of weatherRows || []) cloud[row.record_date] = {...row, savedAt:row.updated_at, entries:[]};
      for (const row of memoRows || []) {
        if (cloud[row.record_date]) cloud[row.record_date].entries.push({memo:row.memo,savedAt:row.saved_at});
      }
      if (typeof records !== "undefined") {
        records = cloud;
        localStorage.setItem(localKey, JSON.stringify(records));
        if (typeof renderHistory === "function") renderHistory();
        if (typeof loadToday === "function") loadToday();
      }
      setMessage("オンライン保存の準備ができました。");
    } catch (error) {
      setMessage("オンライン保存を確認できませんでした。SQL設定を確認してください。");
      console.error("Kokoro Weather sync error", error);
    } finally {
      syncingUser = null;
    }
  }
  login?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("online-email").value.trim();
    setMessage("ログインリンクを送っています…");
    const {error} = await client.auth.signInWithOtp({email, options:{emailRedirectTo:"https://kobayashi193.github.io/kokoro-weather/"}});
    setMessage(error ? "メールを送れませんでした。メールアドレスとAuth設定を確認してください。" : "ログインリンクをメールに送りました。メールを開いてください。");
  });
  document.getElementById("online-logout")?.addEventListener("click", async () => {
    const {error} = await client.auth.signOut();
    if (error) setMessage("ログアウトできませんでした。");
    else location.reload();
  });
  client.auth.onAuthStateChange((_event, session) => setSession(session));
  client.auth.getSession().then(({data}) => setSession(data.session));

  if (isRecordPage) document.addEventListener("click", async (event) => {
    const saveButton = event.target.closest("#save");
    if (!saveButton || !currentUser) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const mode = document.querySelector(".modes button.active")?.dataset.mode || "all";
    const memo = document.querySelector(".memo").value.trim();
    let weatherRow;
    if (mode === "all") {
      const weather = document.querySelector('#all-weather .weather-choice.active')?.dataset.weather;
      if (!weather) return toast("天気をひとつ選んでね。");
      weatherRow = {owner_id:currentUser.id,record_date:todayKey,mode,weather,morning:null,afternoon:null};
    } else {
      const morning = document.querySelector('.weather-choice[data-group="午前"].active')?.dataset.weather;
      const afternoon = document.querySelector('.weather-choice[data-group="午後"].active')?.dataset.weather;
      if (!morning || !afternoon) return toast("午前と午後、それぞれ選んでね。");
      weatherRow = {owner_id:currentUser.id,record_date:todayKey,mode,weather:null,morning,afternoon};
    }
    const savedAt = new Date().toISOString();
    weatherRow.updated_at = savedAt;
    const {error} = await client.from("weather_records").upsert(weatherRow, {onConflict:"owner_id,record_date"});
    if (error) return toast("オンライン保存できませんでした。設定を確認してください。");
    if (memo) {
      const {error:memoError} = await client.from("weather_record_memos").upsert({owner_id:currentUser.id,record_date:todayKey,memo,saved_at:savedAt}, {onConflict:"owner_id,record_date,saved_at"});
      if (memoError) return toast("天気は保存しましたが、メモを保存できませんでした。");
    }
    const previous = records[todayKey] || {};
    const entries = Array.isArray(previous.entries) ? previous.entries.slice() : [];
    if (memo) entries.push({memo,savedAt});
    records[todayKey] = {...weatherRow, savedAt, entries};
    localStorage.setItem(localKey, JSON.stringify(records));
    if (typeof renderHistory === "function") renderHistory();
    document.querySelector(".memo").value = "";
    if (typeof showSuccess === "function") showSuccess();
  }, true);
})();
