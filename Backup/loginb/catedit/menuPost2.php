<?php
session_save_path('../session_data');
session_start();
$kedai=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
			
//error_reporting( error_reporting() & ~E_NOTICE);
//	if(isset($_POST['submit'])){		
//		$sn=$_POST['sn'];
//		echo $sn."<br>";
//	}
print_r($_POST['checkboxName']);
foreach($_POST['checkboxName'] as $checkboxname){
		$chek='checkbox'.$checkboxname;
	if(isset($_POST[$chek])){
		//echo $chek;
		$sql = "UPDATE shop_menu SET menu_available='1' WHERE shop_ID='$kedai' AND menu_sn='$checkboxname'";
	}else{
		$sql = "UPDATE shop_menu SET menu_available='0' WHERE shop_ID='$kedai' AND menu_sn='$checkboxname'";
	}
	mysqli_query($link,$sql);
}
header("location: menuPost.php" );
/*
$foodavailable="";
foreach($_POST['checkbox'] as $checkbox){
	if(isset($checkbox)){
		$foodavailable=$foodavailable."<br>".$checkbox;
	}else{
		$foodavailable="0";
	}
}
echo $foodavailable;
*/
	//$sql = "UPDATE shop_menu SET menu_available='$itemAvailable' WHERE shop_ID='$kedai'";
	
	
	


//	 if (mysqli_query($link,$sql)) {
//		 		//echo "Inserted sucessfully";
//				   header("location: catedit.php" );//如果成功的話跑到 backend.php
//				} else {
//				   echo "Error: " . $sql . "" . mysqli_error($link);//如果失敗就跳error
//	}



?>
