<?php
$kedai=$_GET['k']; //get shop
$meja=$_GET["m"]; //get table
session_save_path('../session_data');
session_start();
//$shopOrderMenu_ID=shopOrder_ID+1;
//$shop_ID=$kedai;
//$shopOrder_table=$meja;
//$shopOrder_date=date('Y-m-d');
//echo $kedai;
require "../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/**查尋該座的情況**/
$sql4="SELECT st_full FROM shop_table WHERE shop_ID='$kedai' AND st_tableNumber='$meja'";//搜索訂單資料指令 捉取數據庫裡Banner的資料
//$sql4="SELECT * FROM shop_table ORDER BY st_sn DESC";
$result4=mysqli_query($link,$sql4);//執行指令,並把結果存到result
//$number_result4=mysqli_num_rows($result4);//符合條件的查詢結果的筆數
$result4_value=mysqli_fetch_array($result4);//把結果轉成array
//echo $result4_value[0];

if($result4_value[0]==0){//如果該座是空的
	$shop_ID=$kedai;
	//echo $shop_ID;
	$shopOrder_table=$meja;
	//echo $shopOrder_table;
    $shopOrder_date=date('Y-m-d');
	
	$sql6="SELECT shopOrder_ID FROM shop_order WHERE shop_ID='$kedai' AND shopOrder_date='$shopOrder_date' ORDER BY shopOrder_ID DESC";//查尋該店今年是否有營否?
	$result6=mysqli_query($link,$sql6);
	$number_result6=mysqli_num_rows($result6);
	//echo $number_result6;
	
	if($number_result6>0){//如果已經有營業了
		$result6_value=mysqli_fetch_array($result6);
		$shopOrder_ID=$result6_value[0]+1; //$shopOrder_ID值疊加
	}else{//如果沒有的話
		$shopOrder_ID=1;//$shopOrder_ID值為1
	}
	$shopOrderMenu_ID=$kedai."-".$meja."-".date('Ymd')."-".$shopOrder_ID;
	echo $shopOrderMenu_ID;
		
	$sql7="INSERT INTO shop_order (shopOrder_ID, shop_ID, shopOrder_table, shopOrder_date, shopOrderMenu_ID) VALUES ('$shopOrder_ID', '$shop_ID', '$shopOrder_table', '$shopOrder_date','$shopOrderMenu_ID')";//搜索訂單資料指令 捉取數據庫裡Banner的資料
	$result7=mysqli_query($link,$sql7);
	
}
?>