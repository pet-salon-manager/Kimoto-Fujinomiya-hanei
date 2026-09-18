# Supabase 接続手順

このアプリは、未設定でも管理者画面が「この端末のみ」モードで動きます。
全利用者へ同じ観光スポット情報を反映する場合は、Supabaseを接続します。

1. Supabase の SQL Editor を開き、`supabase-setup.sql` の内容をすべて実行します。
2. Supabase の Authentication → Users で管理者用ユーザーを1人作成します。
3. 作成したユーザーの UUID をコピーします。
4. SQL Editor で次を実行します。

   insert into public.admin_users (user_id)
   values ('ここに管理者ユーザーのUUID');

5. Project Settings → API から次の2つを確認します。
   - Project URL
   - anon / publishable key
6. `app-config.js` を開き、次のように設定します。

   window.APP_CONFIG = {
     supabaseUrl: "https://xxxxx.supabase.co",
     supabaseAnonKey: "ここにanonまたはpublishable key"
   };

7. GitHub の `Kimoto-Fujinomiya-hanei` の main ブランチ直下へ、このフォルダの全ファイルを上書きします。
8. 管理者画面は次のURLです。

   https://pet-salon-manager.github.io/Kimoto-Fujinomiya-hanei/admin.html

9. 管理者メールアドレス・パスワードでログインします。
10. 初回だけ「初期35件をクラウドへ登録」を押します。

以後、管理者画面で追加・編集・削除・写真アップロードした内容が公開画面へ反映されます。
