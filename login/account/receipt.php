<?php
session_save_path('../session_data');
session_start();
$shop_ID=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
//echo $shop_ID;
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼

$sql0="SELECT * FROM shop_table WHERE shop_ID='$shop_ID' ORDER BY st_tableNumber ASC";//搜索訂單資料指令 捉取數據庫裡Banner的資料
$result0=mysqli_query($link,$sql0);//執行指令,並把結果存到result
$number_result0=mysqli_num_rows($result0);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result0; $i++){
$arr0[$i]=mysqli_fetch_array($result0);
}
//echo $number_result0;
$sql1="SELECT * FROM shop_order WHERE shop_ID='$shop_ID' AND shopOrder_payTime IS NULL ORDER BY shopOrder_sn DESC";//搜索訂單資料指令 捉取數據庫裡Banner的資料
$result1=mysqli_query($link,$sql1);//執行指令,並把結果存到result
$number_result1=mysqli_num_rows($result1);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result1; $i++){
$arr1[$i]=mysqli_fetch_array($result1);
}
//echo $number_result0;
//echo $number_result0;
?>

<!doctype html>
<html>
<head>
	<style>
.grid-container {
  display: grid;
  grid-template-columns: auto auto auto auto;
  background-color: #28A8EF;
  padding: 10px;
}
.grid-item {
  background-color: rgba(255, 255, 255, 0.8);
  border: 10px solid rgba(40,168,239, 0.8);
  padding: 20px;
  font-size: 30px;
  text-align: center;
}
</style>
<meta charset="utf-8">
<title>收費系統</title>
</head>

<body>
	<h1><?php echo $kedai_nama ?>-收費系統</h1>

<div class="grid-container">
	<?php 
		for($i=0; $i<$number_result0; $i++){
			
		
		
	?>
  <div class="grid-item"><a href="receiptpay.php?a=<?php echo $arr0[$i]['st_tableNumber'] ?>">第<?php echo $arr0[$i]['st_tableNumber'] ?>桌</a></div>
 
	<?php
		}
	?>
</div>
</body>
</html>