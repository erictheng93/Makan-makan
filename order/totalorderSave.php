<?php
session_save_path('../session_data');
session_start();
//$food=$_GET['a'];
require "../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼

$shopOrder_sn=$_SESSION['shopOrder_sn'];
//$shopOrder_ID=$_SESSION['shopOrder_ID'];
$shop_ID=$_SESSION['shop_ID'];
$shopOrder_table=$_SESSION['shopOrder_table'];
//$shopOrderMenu_ID=$_SESSION['shopOrderMenu_ID'];
//$shopOrder_ItemName=$_POST['menu_foodname'];
//$shopmenu_sn=$_POST['shopmenu_sn'];
//$menu_priceorigin=$_POST['menu_price'];
$total_price=$_POST['total_price'];
//$num_select=$_POST['num_select'];

//echo $shopOrder_sn."<br>";
//echo $shop_ID."<br>";
//echo $shopOrder_table."<br>";
//echo $total_price."<br>";

$sql11="UPDATE shop_order SET shopOrder_price='$total_price' WHERE shopOrder_sn='$shopOrder_sn'";
$result11=mysqli_query($link,$sql11);
$sql12="UPDATE shop_table SET st_full='1' WHERE shop_ID='$shop_ID' AND st_tableNumber='$shopOrder_table'";
$result12=mysqli_query($link,$sql12);
$sql13="UPDATE shop_ordermenu SET shopOrder_confirm='1' WHERE shopOrder_sn='$shopOrder_sn'";
$result13=mysqli_query($link,$sql13);
echo "<script>alert('訂單確認送出')</script>";
echo "<script>parent.document.getElementById('id01').style.display='none'</script>";

?>