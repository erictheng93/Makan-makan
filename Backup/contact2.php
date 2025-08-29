<?php 
$kedai=$_GET['k']; //get shop
$meja=$_GET["m"]; //get table
session_save_path('session_data');
session_start();
//echo $_SESSION['kedai']."<br>";
//echo $_SESSION['meja']."<br>";
require "config.php";
date_default_timezone_set("Asia/Taipei");
$date=date("Y-m-d H:i:s");
//error_reporting( error_reporting() & ~E_NOTICE);


if(isset($_POST['submit'])){

	$name=$_POST['name'];
	$email=$_POST['email'];
	$comment=$_POST['comment'];
	
//	echo $name;
//	echo $email;
//	echo $comment;
//	echo $date;

    
	$sql = "INSERT INTO shop_contactus (contactUs_name, shop_ID, contactUs_email, contactUs_message, contactUs_receivedtime) VALUES ('$name', '$kedai', '$email', '$comment', '$date')"; //date那邊用CURRENT_TIMESTAMP也可以

	
if (mysqli_query($link,$sql)) {				
               header("location: contactsuccess.php?k=$kedai&m=$meja");//如果成功的話跑到 contactsuccess.php
            } else {
               echo "Error: " . $sql . "" . mysqli_error($link);//如果失敗就跳error
}
	
}
?>