<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login | Apple Style</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', 'San Francisco', 'Roboto', Arial, sans-serif; }
  </style>
</head>

<body class="min-h-screen bg-gradient-to-tr from-slate-100 to-blue-200 flex items-center justify-center">

<?php
if(isset($_GET['no'])){ //如果checkpass那邊偵測到no不等於1的話，就跟著進去tab1.php
	if($_GET['no']==1){ //如果checkpass偵測到no==1的話，就執行A區的代碼（顯示出"帳號或密碼錯誤"）
?>
	<!-- 這是A區    -->
	<div class="w-full max-w-md mx-auto bg-white/90 rounded-3xl shadow-2xl p-8 md:p-10 border border-slate-200 backdrop-blur-md">
  <div class="flex flex-col items-center mb-6">
    <svg class="w-12 h-12 mb-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 01.88 7.9A5.5 5.5 0 0112 21a5.5 5.5 0 01-4.88-6.1A4 4 0 118 7" /></svg>
    <h2 class="text-2xl font-semibold text-slate-800 tracking-tight">登入您的帳號</h2>
  </div>
  <form class="space-y-5" method="post" action="checkpass.php">
    <input type="text" name="id_input" placeholder="使用者名稱" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base placeholder-slate-400 transition" required />
    <input type="password" name="pass_input" placeholder="密碼" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base placeholder-slate-400 transition" required />
    <button type="submit" class="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium shadow-md transition">登入</button>
    <p class="text-center text-red-500 text-sm mt-2 font-medium">帳號或密碼錯誤,或欄位有空白</p>
  </form>
</div>

<?php 
	}
}else{ //這是B區
?>
	<!--   一開始顯示的會是這個區塊     -->
	<div class="w-full max-w-md mx-auto bg-white/90 rounded-3xl shadow-2xl p-8 md:p-10 border border-slate-200 backdrop-blur-md">
  <div class="flex flex-col items-center mb-6">
    <svg class="w-12 h-12 mb-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 01.88 7.9A5.5 5.5 0 0112 21a5.5 5.5 0 01-4.88-6.1A4 4 0 118 7" /></svg>
    <h2 class="text-2xl font-semibold text-slate-800 tracking-tight">登入您的帳號</h2>
  </div>
  <form class="space-y-5" method="post" action="checkpass.php">
    <input type="text" name="id_input" placeholder="使用者名稱" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base placeholder-slate-400 transition" required />
    <input type="password" name="pass_input" placeholder="密碼" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base placeholder-slate-400 transition" required />
    <button type="submit" class="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium shadow-md transition">登入</button>
    <p class="text-center text-slate-500 text-sm mt-2 font-medium">請輸入帳號和密碼</p>
  </form>
</div>

<?php
}
?>

</body>
</html>