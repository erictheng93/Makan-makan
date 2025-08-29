<?php
session_save_path('../session_data');
session_start();
$kedai=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_table要顯示的物件 開始 */
$sql="SELECT * FROM shop_table WHERE shop_ID='$kedai' ORDER BY st_tableNumber ASC";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}
error_reporting( error_reporting() & ~E_NOTICE);


$array=$arr[$i]['st_tableNumber'];
$element=count($array);
echo $element;

//	if(isset($_POST['insertable'])){
		
		//$newtable=$insertable+1;
//		echo $insertable."<br>";
		


		//$sql = "INSERT INTO shop_table (shop_ID, st_tableNumber ) VALUES ('$kedai', '$newtable' )";
	
	
	


//	 if (mysqli_query($link,$sql)) {		 		
//				   header("location: tableedit.php" );//一秒後跳轉到catedit.php
//				} else {
//				   echo "Error: " . $sql . "" . mysqli_error($link);//如果失敗就跳error
//	}

		
//	}
	?>