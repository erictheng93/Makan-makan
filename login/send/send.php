<?php
require "../../config.php";
$item=$_GET['a'];
echo $item;
//$sql="UPDATE shop_ordermenu SET shopOrder_make='1' WHERE shopOrderMenu_sn='$item'";
$sql="UPDATE shop_ordermenu SET shopOrder_send='1' WHERE shopOrderMenu_sn='$item'";
if (mysqli_query($link,$sql)){
	header('Location: index.php' );	
}
?>