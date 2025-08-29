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

/* 選擇Food主食 開始 */
$sql4="SELECT * FROM shop_order WHERE shop_ID='$kedai' ORDER BY shopOrder_qty DESC";//搜索資料指令
$result4=mysqli_query($link,$sql4);//執行指令,並把結果存到result
$number_result4=mysqli_num_rows($result4);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result4; $i++){
$arr4[$i]=mysqli_fetch_array($result4);
}
/* 選擇Food主食 結束 */
?>

<!DOCTYPE html>
<html lang="en" >
<head>
<meta charset="UTF-8">
<title>熱門點餐</title>
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

      <h2>熱門點餐</h2>
      
      <h2 class="food-menu-heading">熱門點餐</h2>
      <div class="food-menu-container container">
        <?php for($i=0; $i<$number_result4; $i++){ ?>
		  <div class="food-menu-item">			
          <div class="food-img">
            <img src="image/<?php echo $arr4[$i]['shopOrder_pictures'] ?>" onerror="this.onerror=null; this.src='./image/sorry.jpg'" alt="目前沒有圖片"/> <!-- 食物照片 --> 
          </div>
          <div class="food-description">
            <h2 class="food-titile"><?php echo $arr4[$i]['shopOrder_name'] ?></h2> <!-- 食物名稱 -->
            <p>
            <?php echo $arr4[$i]['shopOrder_describe'] ?> <!-- 食物簡介 -->
            </p>
            <div class="star-rating">
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
          	</div>
            <p class="food-price">價格:$<?php echo $arr4[$i]['shopOrder_price'] ?></p> <!-- 食物價格 -->
          </div>
        </div>
		  <?php } ?>

      </div>
    

   
</body>
</html>
