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
?>

<!DOCTYPE html>
<html lang="en" >
<head>
<meta charset="UTF-8">
<title>最多好評</title>
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

      <h2>最多好評</h2>      
      <h2 class="food-menu-heading">最多好評</h2>
      <div class="food-menu-container container">
        <div class="food-menu-item">
          <div class="food-img">
            <img src="image/menu1.jpg" alt="" />
          </div>
          <div class="food-description">
            <h2 class="food-titile">炒粿條</h2>
            <p>
              檳城首選小吃,鍋氣十足,炒粿條主要有粿條，佐料有雞蛋、鮮蛤、蝦子、芽菜、韭菜、豬油渣，而且有的還有鴨蛋、蟹肉絲、蝦蛄等選擇
            </p>
            <div class="star-rating">
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
          	</div>
            <p class="food-price">價格: $RM 7.50</p>
          </div>
        </div>

        <div class="food-menu-item">
          <div class="food-img">
            <img
              src="image/menu2.jpg"
              alt="error"
            />
          </div>
          <div class="food-description">
            <h2 class="food-titile">福建蝦面</h2>
            <p>
              是一道利用蝦殼及辣椒熬煮的赤紅辛辣湯底，再配上黃麵條、米粉、蝦和蕹菜等而成的麵食料理
            </p>
            <div class="star-rating">
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star-o checked"></span>
          	</div>
            <p class="food-price">價格: $RM 5.50</p>
          </div>
        </div>
        <div class="food-menu-item">
          <div class="food-img">
            <img src="image/menu3.jpg" alt="" />
          </div>
          <div class="food-description">
            <h2 class="food-titile">咖喱麵</h2>
            <p>
              是一道由馬來人、華人、等不同文化混合的麵食料理。馬來半島上有許多不同族群，加上地理分隔，造成不同族群及不同地方的咖喱面都會有所不同，但基本原料相同。
            </p>
            <div class="star-rating">
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star-o checked"></span>
          	</div>
            <p class="food-price">價格: $RM 5.00</p>
          </div>
        </div>
        <div class="food-menu-item">
          <div class="food-img">
            <img src="image/menu4.jpg" alt="" />
          </div>
          <div class="food-description">
            <h2 class="food-titile">檳城亞參叻沙</h2>
            <p>
              亞參叻沙的湯底是用甘文魚(ikan kembung)或馬鮫魚熬制的略帶酸味的濃湯，在熬制過程中，加入姜花、南薑、香茅、紅蔥頭、辣椒、叻沙葉（Daun Kesum）、峇拉煎(Belacan)、用羅望子製成的亞參膏和亞參果片(asam gelugur/asam keping)等
            </p>
            <div class="star-rating">
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star-o checked"></span>
                <span class="fa fa-star-o checked"></span>
          	</div>
            <p class="food-price">價格: $RM 5.50</p>
          </div>
        </div>
        <div class="food-menu-item">
          <div class="food-img">
            <img src="image/menu5.jpg" alt="" />
          </div>
          <div class="food-description">
            <h2 class="food-titile">雲吞麵</h2>
            <p>
              是一道著名的廣東麵食，馬來西亞人稱之為“Wan Tan Mee”（粵語發音）。雲吞面在馬來西亞是最常見和受歡迎的麵食，長期以來都是馬來西亞華人愛吃的麵食之一
            </p>
            <div class="star-rating">
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star-o checked"></span>
          	</div>
            <p class="food-price">價格: $RM 5.50</p>
          </div>
        </div>
        <div class="food-menu-item">
          <div class="food-img">
            <img src="image/menu6.jpg" alt="" />
          </div>
          <div class="food-description">
            <h2 class="food-titile">椰漿飯</h2>
            <p>
              椰漿飯由椰奶蒸飯、香斑斕葉、辣椒醬、炸花生鳳尾魚、黃瓜片和半個煮雞蛋構成。用雙層的香蕉葉和舊報紙（或棕色蠟紙）包裹成金字塔形狀。還有其他配菜，如牛肉巴東，五香炸雞或各種海鮮。
            </p>
            <div class="star-rating">
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star checked"></span>
                <span class="fa fa-star-o checked"></span>
          	</div>
            <p class="food-price">價格: $RM 5.50</p>
          </div>
        </div>
      </div>
    

   
</body>
</html>
