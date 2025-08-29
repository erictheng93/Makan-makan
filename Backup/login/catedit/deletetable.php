<?php
session_save_path('../session_data');
session_start();
$kedai=$_SESSION['shop_ID'];
$tableSN=$_GET['deletetable'];
require "../../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
//	echo $kedai."<br>";
//	echo $kedai_nama."<br>";
//	echo $tableSN."<br>";

$sql = "DELETE from shop_table WHERE shop_ID='$kedai' AND st_sn='$tableSN'";
if (mysqli_query($link,$sql)) {               
				header("location: tableedit.php"); //执行成功
            } else {
               echo "Error: " . $sql."" . mysqli_error($link); //如果执行失败,就显示Error
			}
?>

<script type="text/javascript">
	parent.$.fancybox.close();
</script>