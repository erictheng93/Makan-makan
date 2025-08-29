<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>
	<style type="text/css">
	@import url(https://fonts.googleapis.com/css?family=Roboto:300);

.login-page {
  width: 360px;
  padding: 8% 0 0;
  margin: auto;
}

/*  Login Form CSS Start  */
.form {
  position: relative;
  z-index: 1;
  background: #FFFFFF;
  max-width: 360px;
  margin: 0 auto 100px;
  padding: 45px;
  text-align: center;
  box-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.2), 0 5px 5px 0 rgba(0, 0, 0, 0.24);
}
.form input {
  font-family: "Roboto", sans-serif;
  outline: 0;
  background: #f2f2f2;
  width: 100%;
  border: 0;
  margin: 0 0 15px;
  padding: 15px;
  box-sizing: border-box;
  font-size: 14px;
}
.form button {
  font-family: "Roboto", sans-serif;
  text-transform: uppercase;
  outline: 0;
  background: #52eac1;
  width: 100%;
  border: 0;
  padding: 15px;
  color: #FFFFFF;
  font-size: 14px;
  -webkit-transition: all 0.3 ease;
  transition: all 0.3 ease;
  cursor: pointer;
}
.form button:hover,.form button:active,.form button:focus {
  background: #43A047;
}
.form .message {
  margin: 15px 0 0;
  color: #b3b3b3;
  font-size: 12px;
}
.form .message a {
  color: #4CAF50;
  text-decoration: none;
}
.form .register-form {
  display: none;
}
/*  Login Form CSS End  */
		
.container {
  position: relative;
  z-index: 1;
  max-width: 300px;
  margin: 0 auto;
}
.container:before, .container:after {
  content: "";
  display: block;
  clear: both;
}
.container .info {
  margin: 50px auto;
  text-align: center;
}
.container .info h1 {
  margin: 0 0 15px;
  padding: 0;
  font-size: 36px;
  font-weight: 300;
  color: #1a1a1a;
}
.container .info span {
  color: #4d4d4d;
  font-size: 12px;
}
.container .info span a {
  color: #000000;
  text-decoration: none;
}
.container .info span .fa {
  color: #EF3B3A;
}
body {
  background: #39d1e5; /* fallback for old browsers */
  background: -webkit-linear-gradient(right, #39d1e5, #8DC26F);
  background: -moz-linear-gradient(right, #39d1e5, #8DC26F);
  background: -o-linear-gradient(right, #39d1e5, #8DC26F);
  background: linear-gradient(to left, #39d1e5, #8DC26F);
  font-family: "Roboto", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;      
}
</style>
	
<script type="text/javascript">
		$('.message a').click(function(){
   $('form').animate({height: "toggle", opacity: "toggle"}, "slow");
});
		
</script>
	
<body>
	
<?php
if(isset($_GET['no'])){ //如果checkpass那邊偵測到no不等於1的話，就跟著進去tab1.php
	if($_GET['no']==1){ //如果checkpass偵測到no==1的話，就執行A區的代碼（顯示出"帳號或密碼錯誤"）
?>
	<!-- 這是A區    -->
	<div class="login-page">
          <div class="form">
            <form class="login-form" method="post" action="checkpass.php"> <!-- 把資料送去checkpass.php  -->
              <input type="text" placeholder="username" name="id_input"/> <!-- 把登錄者的賬號送過去checkpass.php  -->
              <input type="password" placeholder="password"  name="pass_input"/> <!-- 把登錄者的密碼送過去checkpass.php  -->
              <button>login</button> <!-- Login 按鈕  -->
              <p class="message"><?php echo "帳號或密碼錯誤,或欄位有空白";?></p> <!-- 經過session check如果對應不到的話，就redirect回來並顯示這個區塊  -->
            </form>
          </div>
	</div>
    
<?php 
	}
}else{ //這是B區
?>
	<!--   一開始顯示的會是這個區塊     -->
	<div class="login-page">
          <div class="form">
            <form class="login-form" method="post" action="checkpass.php"> <!-- 把資料送去checkpass.php  -->
              <input type="text" placeholder="username" name="id_input"/> <!-- 把登錄者的賬號送過去checkpass.php  -->
              <input type="password" placeholder="password"  name="pass_input"/> <!-- 把登錄者的密碼送過去checkpass.php  -->
              <button>login</button> <!-- Login 按鈕  -->
              <p class="message"><?php echo "請輸入帳號和密碼";?></p> <!-- 一開始登錄者看到的就是這個區塊  -->
            </form>
          </div>
	</div>
	
<?php
}
?>

</body>
</html>