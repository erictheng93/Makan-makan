<?php 
require "configfornewshop.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇Banner要顯示的物件 開始 */
$sql="SELECT * FROM newshoptable_indexpage";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}
/* 選擇Banner要顯示的物件 結束 */

/* 選擇Navigation要顯示的物件 開始 */
$sql2="SELECT * FROM newshoptable_navigation";//搜索資料指令 捉取數據庫裡Banner的資料
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($ii=0; $ii<$number_result2; $ii++){
$arr2[$ii]=mysqli_fetch_array($result2);
}
/* 選擇Navigation要顯示的物件 結束 */

/* 選擇food-intro招牌菜色 開始 */
$sql8="SELECT * FROM newshoptable_product WHERE xxxProduct_recommended='1' AND xxxProduct_available='1'";//搜索資料指令
$result8=mysqli_query($link,$sql8);//執行指令,並把結果存到result
$number_result8=mysqli_num_rows($result8);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result8; $i++){
$arr8[$i]=mysqli_fetch_array($result8);
}
/* 選擇food-intro招牌菜色 結束 */
?>


<!DOCTYPE html>
<html lang="en" >
<head>
<meta charset="UTF-8">
<title>招牌菜色</title>
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="css/font-awesome.min.css"> 
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
              <!--	這邊是首頁的 Navigation	開始	  -->
			  <?php for($ii=0; $ii<$number_result2; $ii++){ ?>
              <li><a href="<?php echo $arr2[$ii]['xxxnav_directed'] ?>"><?php echo $arr2[$ii]['xxxnav_item'] ?></a></li>
			  <?php } ?>
			  <!--	這邊是首頁的 Navigation	結束	  -->
          </ul>
          <!--	這邊是LOGO	開始	  -->
          <h1 class="logo">
			  <img src="image/<?php echo $arr[0]['xxxfp_logo'] ?>" alt="YourLogo"></h1> <!-- 店家的LOGO -->
		  <!--	這邊是LOGO	結束	  -->
      </div>
 </nav>

      <h2>店家推薦</h2>      
      <h2 class="food-menu-heading">店家推薦</h2>
      <div class="food-menu-container container">
        <?php for($i=0; $i<$number_result8; $i++){ ?>
		  <div class="food-menu-item">
          <div class="food-img">			  
            <img src="image/<?php echo $arr8[$i]['xxxProduct_pictures'] ?>" alt="" />			 
          </div>			
          <div class="food-description">			  
            <h2 class="food-titile"><?php echo $arr8[$i]['xxxProduct_name'] ?></h2> <!-- 品相名稱 -->
            <p><?php echo $arr8[$i]['xxxProduct_describe'] ?></p>
            <div class="star-rating">
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
          	</div>
            <p class="food-price">價格: $RM<?php echo $arr8[$i]['xxxProduct_price'] ?></p> <!--  商品價格  -->			 
          </div>			
        </div>
		  <?php } ?>
      </div>
    

   
</body>
</html>
