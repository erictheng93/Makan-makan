<?php 
$kedai=$_GET['k']; //get shop
$meja=$_GET["m"]; //get table
session_save_path('session_data');
session_start();
//echo $_SESSION['kedai']."<br>";
//echo $_SESSION['meja']."<br>";

require "config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_info要顯示的物件 開始 */
$sql="SELECT * FROM shop_info WHERE shop_ID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}
/* 選擇shop_info要顯示的物件 結束 */

?>


<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Contact Us</title>  
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet' href='css/font-awesome.min.css">
    <link rel="stylesheet" href="css/style.css" />
  </head>

<body>
<nav class="navbar">
      <div class="navbar-container container">
          <input type="checkbox" name="" id="">
          <div class="hamburger-lines">
              <span class="line line1"></span>
              <span class="line line2"></span>
              <span class="line line3"></span>
          </div>
          <ul class="menu-items">
              <li><a href="index.html">首頁</a></li>
              <li><a href="food.html">一般點餐</a></li>
              <li><a href="food-hot.html">熱門點餐</a></li>
              <li><a href="food-intro.html">店家推薦</a></li>
              <li><a href="food-bestintro.html">最多好評</a></li>
              <li><a href="comment.html">食客評議</a></li>
              <li><a href="contact.html">聯絡我們</a></li>
          </ul>
          <!--	這邊是LOGO	開始	  -->
          <h1 class="logo">
			  <img src="image/<?php echo $arr[0]['shop_logo'] ?>" alt="YourLogo"></h1> <!-- 店家的LOGO -->
		  <!--	這邊是LOGO	結束	  -->
      </div>
      </nav>
      <h2>聯絡我們</h2>
		<br>
      <h2 class="food-menu-heading">聯絡我們</h2>
      <div class="contact-container container">
        <div class="contact-img">
          <img src="image/restraunt2.jpg" alt="" />
        </div>

		 
        <div class="form-container">		
          <h2>聯絡我們</h2>
		<form id="form1" name="form1" method="post" action="contact2.php?k=<?php echo $kedai ?>&m=<?php echo $meja ?>">
          <input type="text" name="name" id="name" placeholder="暱稱" required />
          <input type="email" name="email" id="email" placeholder="E-Mail" required />
          <textarea cols="30" rows="6" name="comment" id="comment" placeholder="留言" required></textarea>
          <input type="submit" name="submit" id="submit" class="btn btn-primary" style="color: #FFFFFF" value="確定送出" >
			</form>
        </div>
      </div>
   
</body>
</html>