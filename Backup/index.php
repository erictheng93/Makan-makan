<?php 
$kedai=$_GET['k']; //get shop
$meja=$_GET["m"]; //get table
//Session
session_save_path('session_data');
session_start();
$_SESSION['kedai']=$kedai;
$_SESSION['meja']=$meja;

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

/* Navigation的URL導入 開始 */
$sql2="SELECT * FROM shop_table WHERE shop_ID='$kedai' AND st_tableNumber='$meja'";//搜索資料指令 捉取數據庫裡Banner的資料
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result2; $i++){
$arr2[$i]=mysqli_fetch_array($result2);
}
/* Navigation的URL導入 開始 */

?>


<!DOCTYPE html>
<html lang="en" >
<head>
<meta charset="UTF-8">
<title>民以食為天</title>
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel='stylesheet' href='css/font-awesome.min.css'>
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
			  <li><a href="index.php?k=<?php echo $arr2[0]['shop_ID']?>&m=<?php echo $arr2[0]['st_tableNumber'] ?>">首頁</a></li>
              <li><a href="food.php?k=<?php echo $arr2[0]['shop_ID']?>&m=<?php echo $arr2[0]['st_tableNumber'] ?>">一般點餐</a></li>
              <li><a href="food-hot.php?k=<?php echo $arr2[0]['shop_ID']?>&m=<?php echo $arr2[0]['st_tableNumber'] ?>">熱門點餐</a></li>
              <li><a href="food-intro.php?k=<?php echo $arr2[0]['shop_ID']?>&m=<?php echo $arr2[0]['st_tableNumber'] ?>">店家推薦</a></li>
              <li><a href="food-bestintro.php?k=<?php echo $arr2[0]['shop_ID']?>&m=<?php echo $arr2[0]['st_tableNumber'] ?>">最多好評</a></li>
              <li><a href="comment.php?k=<?php echo $arr2[0]['shop_ID']?>&m=<?php echo $arr2[0]['st_tableNumber'] ?>">食客評議</a></li>
              <li><a href="contact.php?k=<?php echo $arr2[0]['shop_ID']?>&m=<?php echo $arr2[0]['st_tableNumber'] ?>">聯絡我們</a></li>
          </ul>
		  <!--	這邊是LOGO	開始	  -->
          <h1 class="logo">
			  <img src="image/<?php echo $arr[0]['shop_logo'] ?>" onerror="this.onerror=null; this.src='./image/sorry.jpg'" alt="目前沒有圖片"></h1> <!-- 店家的LOGO -->
		  <!--	這邊是LOGO	結束	  -->
      </div>
  </nav>
    <section class="showcase-area" id="showcase">
      <div class="showcase-container">
<!--	這裡是indexpage的Banner主標題和副標題 開始  -->
        <h1 class="main-title" id="home"><?php echo $arr[0]['shop_banner_title'] ?></h1>
        <p><?php echo $arr[0]['shop_banner_subtitle'] ?></p>
<!--	這裡是indexpage的Banner主標題和副標題 結束 -->
        <a href="food.php?k=<?php echo $arr2[0]['shop_ID']?>&m=<?php echo $arr2[0]['st_tableNumber'] ?>" class="btn btn-primary">菜單</a>
      </div>
    </section>
   
    
    <section id="about">
      <div class="about-wrapper container">
        <div class="about-text">
<!--	這裡是indexpage的首頁主標題和副標題 開始 -->	
          <p class="small"><?php echo $arr[0]['shop_mainTitle'] ?></p>          
          <p>
			<?php echo $arr[0]['shop_content'] ?>            
          </p>
<!--	這裡是indexpage的首頁主標題和副標題 結束 -->
        </div>
<!--	這裡是indexpage的首頁圖片 開始 -->
        <div class="about-img">          
		  <img src="image/<?php echo $arr[0]['shop_image'] ?> " alt="food" />
        </div>
<!--	這裡是indexpage的首頁圖片 結束 -->
      </div>
    </section>
    
    <footer id="footer">
      <h2>民以食為天 &copy; 版權所有</h2>
    </footer>
  </body>
  <!-- 
    .................../ JS Code for smooth scrolling /...................... -->

  <script src="jquery.min.js"></script>
  <script>
    $(document).ready(function () {
      // Add smooth scrolling to all links
      $("a").on("click", function (event) {
        // Make sure this.hash has a value before overriding default behavior
        if (this.hash !== "") {
          // Prevent default anchor click behavior
          event.preventDefault();

          // Store hash
          var hash = this.hash;

          // Using jQuery's animate() method to add smooth page scroll
          // The optional number (800) specifies the number of milliseconds it takes to scroll to the specified area
          $("html, body").animate(
            {
              scrollTop: $(hash).offset().top,
            },
            800,
            function () {
              // Add hash (#) to URL when done scrolling (default click behavior)
              window.location.hash = hash;
            }
          );
        } // End if
      });
    });
  </script>

<!-- partial -->
  

</html>
