<?php
session_save_path('../session_data');
session_start();
$shop_ID=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
$shopOrder_sn=$_GET['a'];
$shopOrder_table=$_GET['t'];
$pay_Time=date("h:i:s");
$sql12="UPDATE shop_order SET shopOrder_payTime='$pay_Time' WHERE shopOrder_sn='$shopOrder_sn' ";
$result12=mysqli_query($link,$sql12);
$sql13="UPDATE shop_table SET st_full='0' WHERE shop_ID='$shop_ID' AND st_tableNumber='$shopOrder_table'";
$result13=mysqli_query($link,$sql13);
header('Location: receipt.php' );	
?>
