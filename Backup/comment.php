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
<html>
<head>
<meta charset="UTF-8">
<title>最多好評</title>
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="css/font-awesome.min.css">
    <link rel="stylesheet" href="css/style.css" />
    <link rel="stylesheet" href="css/starcss.css">
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

      <h2>食客評議</h2>
		<br>
      <h2 class="testimonial-title">食客評議</h2>
      <div class="testimonial-container container">
        <div class="testimonial-box">
          <div class="customer-detail">
            <div class="customer-photo">
              <img src="image/male-photo1.jpg" alt="" />
              <p class="customer-name">大衛</p>
            </div>
          </div>
          <div class="star-rating">
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
          </div>
          <p class="testimonial-text">
            粿條很好吃,鍋氣足,火候足夠
          </p>
         
        </div>
        <div class="testimonial-box">
          <div class="customer-detail">
            <div class="customer-photo">
              <img
                src="image/female-photo1.jpg"
                alt=""
              />
              <p class="customer-name">珊妮</p>
            </div>
          </div>
          <div class="star-rating">
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
          </div>
          <p class="testimonial-text">
            咖哩麵的椰漿味濃郁
          </p>
         
        </div>
        <div class="testimonial-box">
          <div class="customer-detail">
            <div class="customer-photo">
              <img src="image/male-photo3.jpg" alt="" />
              <p class="customer-name">班東尼</p>
            </div>
          </div>
          <div class="star-rating">
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
            <span class="fa fa-star checked"></span>
          </div>
          <p class="testimonial-text">
            椰漿飯很香,價格親民
          </p>
         
        </div>
      </div>
    
<!-- partial:index.partial.html -->
<div class="rating-box">
<form class="rating-form">
  <fieldset>
    <span class="star-cb-group">
      <input type="radio" id="rating-5" name="rating" value="5" /><label for="rating-5">5</label>
      <input type="radio" id="rating-4" name="rating" value="4" /><label for="rating-4">4</label>
      <input type="radio" id="rating-3" name="rating" value="3" /><label for="rating-3">3</label>
      <input type="radio" id="rating-2" name="rating" value="2" /><label for="rating-2">2</label>
      <input type="radio" id="rating-1" name="rating" value="1" /><label for="rating-1">1</label>
      <input type="radio" id="rating-0" name="rating" value="0" checked="checked" class="star-cb-clear" /><label for="rating-0">0</label>
    </span>
  </fieldset>
  <fieldset>
    <input type="text" name="alias" id="alias" class="text-field" value="" maxlength="50" placeholder="暱稱" required>
    </fieldset>
  <fieldset>
    <textarea name="review" id="review" maxlength="100" placeholder="寫下您的評議" required></textarea>
    </fieldset>
  <span class="error">error Msg</span>
  <fieldset>
    <input type="button" value="確定送出" id="submit">
    </fieldset>
  
</form>
  <p class="rating-success">謝謝您的建言</p>
</div>
<!-- partial -->
<script src="js/jquery.min.js"></script><script src="js/script.js"></script>
   
</body>
</html>
