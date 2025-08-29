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



	echo "<h1>感謝您的來信。<br>您的信息已被收到。</h1>";
	header("refresh:2;url=contact.php?k=$kedai&m=$meja");
?>