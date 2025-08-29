<?php
require "../config.php";
$foodserial=$_GET['foodserial'];
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇Food主食 開始 */
$sql2="SELECT * FROM shop_menu WHERE menu_sn=$foodserial";//搜索資料指令
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result2; $i++){
$arr2[$i]=mysqli_fetch_array($result2);
}
/* 選擇Food主食 結束 */
?>

<!DOCTYPE html>
<html lang="en" >
<head>
  <meta charset="UTF-8">
  <title>Food Ordering Page</title>
  <link rel="stylesheet" href="./css/order2.css">

</head>
<body>
<!-- partial:index.partial.html -->
<section class="cards">

  <div class="card">
    <div class="card__image a">
      <img src="../login/edit/image/<?php echo mb_substr($arr2[0]['menu_pictures'],0,-5)?>.jpg" width="390" height="260" alt="Food Image">
    </div>
    <div class="card__content">
      <div class="card__title"><?php echo $arr2[0]['menu_foodname']?></div>
      	<div class="card__text">zzzzz</div>
		<div class="card__text">zzzzz</div>
		<div class="card__text">zzzzz</div>
		<div class="card__text">zzzzz</div>
		<div class="card__text">zzzzz</div>
      <a href="#" class="card__readmore">Read More</a>
    </div>
  </div>
	
</section>
<!-- partial -->
  
</body>
</html>
