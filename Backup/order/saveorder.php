<!doctype html>
<?php
session_save_path('../session_data');
session_start();
$food=$_GET['a'];
require "../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼

$shopOrder_sn=$_SESSION['shopOrder_sn'];
$shopOrder_ID=$_SESSION['shopOrder_ID'];
$shop_ID=$_SESSION['shop_ID'];
$shopOrder_table=$_SESSION['shopOrder_table'];
$shopOrderMenu_ID=$_SESSION['shopOrderMenu_ID'];
$shopOrder_ItemName=$_POST['menu_foodname'];
$shopmenu_sn=$_POST['shopmenu_sn'];
$menu_priceorigin=$_POST['menu_price'];
$menu_price=$menu_priceorigin;
$num_select=$_POST['num_select'];
$checkbox1=$_POST['checkbox1'];
	if(isset($_POST['checkbox1'])){
		$checkbox1="加辣";
	}else{
		$checkbox1="";
	}
$checkbox2=$_POST['checkbox2'];
	if(isset($_POST['checkbox2'])){
		$checkbox2="加量";
		$menu_price=$menu_priceorigin+10;
	}else{
		$checkbox2="";
	}
$checkbox3=$_POST['checkbox3'];
	if(isset($_POST['checkbox3'])){
		$checkbox3="加蛋";
		$menu_price=$menu_priceorigin+10;
	}else{
		$checkbox3="";
	}
$menu_price=$menu_price*$num_select;
$shopOrder_note=$checkbox1."/".$checkbox2."/".$checkbox3;
$shopOrder_date=date('Y-m-d');
$shopOrder_Time=date("h:i:s");
/*
echo $shopOrder_sn."<br>";
echo $shopOrder_ID."<br>";
echo $shop_ID."<br>";
echo $shopOrder_table."<br>";
echo $shopOrderMenu_ID."<br>";
echo $shopOrder_ItemName."<br>";
echo $shopmenu_sn."<br>";
echo $menu_price."<br>";
echo $menu_priceorigin."<br>";
echo $num_select."<br>";
echo $shopOrder_note."<br>";
echo $checkbox1."<br>";
echo $checkbox2."<br>";
echo $checkbox3."<br>";
echo $shopOrder_date."<br>";
echo $shopOrder_Time."<br>";
*/
$sql7="INSERT INTO shop_ordermenu (shopOrderMenu_ID, shopOrder_sn, shop_ID, shopOrder_table, shopmenu_sn, shopOrder_date, shopOrder_Time,shopOrder_ItemPriceOrigin, shopOrder_ItemPriceTotal, shopOrder_ItemName, shopOrder_itemQuantity, shopOrder_note) VALUES ('$shopOrderMenu_ID', '$shopOrder_sn', '$shop_ID', '$shopOrder_table','$shopmenu_sn','$shopOrder_date','$shopOrder_Time','$menu_priceorigin','$menu_price','$shopOrder_ItemName','$num_select','$shopOrder_note')";//搜索訂單資料指令 捉取數據庫裡Banner的資料
	if (mysqli_query($link,$sql7)) {
  		$last_id = mysqli_insert_id($link);
		echo "<script>parent.document.getElementById('id01').style.display='none'</script>";
  		//echo "New record created successfully. Last inserted ID is: " . $last_id;
	} 
//<body onload="parent.document.getElementById('id01').style.display='none'">
?>
