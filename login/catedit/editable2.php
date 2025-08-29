<?php
session_save_path('../session_data');
session_start();
$kedai=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼

	if(isset($_POST['submit'])){		
		$tableNumber=$_POST['tableNumber'];
		$sn=$_POST['sn'];
		
//		echo $editedtable."<br>";
//		echo $sn;


		$sql = "UPDATE shop_table SET st_tableNumber='$tableNumber' WHERE shop_ID='$kedai' && st_sn='$sn' ";
	
	
	


	 if (mysqli_query($link,$sql)) {
		 		echo "<h1>成功修改桌子編號，一秒後將自動跳轉</h1>";
				   header("refresh:1;url=catedit.php" );//一秒後跳轉到catedit.php
				} else {
				   echo "Error: " . $sql . "" . mysqli_error($link);//如果失敗就跳error
	}

		
	}
	?>