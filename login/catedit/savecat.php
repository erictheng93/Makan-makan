<?php
//print_r($_POST['Checkbox']) ;
session_save_path('../session_data');
session_start();
$kedai=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼

//error_reporting( error_reporting() & ~E_NOTICE);

	if(isset($_POST['submit'])){
		
		$checkbox=$_POST['Checkbox'];
		//echo $checkbox;
		$shopcategory=implode(',',$checkbox);
		echo $shopcategory;

		$sql = "UPDATE shop_info SET shop_category='$shopcategory' WHERE shop_ID='$kedai'";
	
	
	


	 if (mysqli_query($link,$sql)) {
		 		//echo "Inserted sucessfully";
				   header("location: catedit.php" );//如果成功的話跑到 backend.php
				} else {
				   echo "Error: " . $sql . "" . mysqli_error($link);//如果失敗就跳error
	}

		
	}


?>
	
</body>
</html>