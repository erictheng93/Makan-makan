<?php
require "../../config.php";
session_save_path('../session_data');
session_start();
//echo $_SESSION['kedai']."<br>";
//echo $_SESSION['meja']."<br>";

$kedai=$_SESSION['shop_ID'];

date_default_timezone_set("Asia/Taipei");
$date=date("Y-m-d");
$time=date("H:i:s");;
	
	if(isset($_POST['category'])){
		$category=$_POST['category'];
	}else{
		$category="";
	}
	
	if(isset($_POST['sub_category'])){
		$sub_category=$_POST['sub_category'];
	}else{
		$sub_category="";
	}
	
	if(isset($_POST['foodName'])){
		$foodName=$_POST['foodName'];
	}else{
		$foodName="";
	}
	
	if(isset($_POST['foodIntro'])){
		$foodIntro=$_POST['foodIntro'];
	}else{
		$foodIntro="";
	}
	
	if(isset($_POST['foodPrice1'])){
		$foodPrice1=$_POST['foodPrice1'];
	}else{
		$foodPrice1="";
	}
	
	if(isset($_POST['foodPrice2'])){
		$foodPrice2=$_POST['foodPrice2'];
	}else{
		$foodPrice2="";
	}
	
	if(!empty($foodPrice1)&&!empty($foodPrice2)){
		$foodPrice3=$foodPrice1.".".$foodPrice2;
	}elseif(!empty($foodPrice1)&&empty($foodPrice2)){
		$foodPrice3=$foodPrice1;
	}elseif(empty($foodPrice1)&&!empty($foodPrice2)){
		$foodPrice3="0.".$foodPrice2;
	}else{
		$foodPrice3="";
	}
		
	
	if(isset($_POST['indoor'])){
		//$indoor=$_POST['indoor'];
		$indoor=1;
	}else{
		//$indoor="";
		$indoor=0;
	}
	
//	if(!empty($indoor)){
//		$indoor=1;
//	}else{
//		$indoor=0;
//	}
	
	if(isset($_POST['outdoor'])){
		$outdoor=1;
	}else{
		$outdoor=0;
	}

	if(isset($_POST['branded'])){
		$branded=1;
	}else{
		$branded=0;
	}

	if(isset($_POST['remark'])){
		$remark=$_POST['remark'];
	}else{
		$remark="";
	}
	
	if(isset($_POST['nonveg'])){
		//$nonveg=$_POST['nonveg'];
		$nonveg=1;
	}else{
		//$nonveg="";
		$nonveg=0;
	}
	
	if(isset($_POST['wholeveg'])){
		//$wholeveg=$_POST['wholeveg'];
		$wholeveg=1;
	}else{
		//$wholeveg="";
		$wholeveg=0;
	}
	
	if(isset($_POST['eggveg'])){
		//$eggveg=$_POST['eggveg'];
		$eggveg=1;
	}else{
		//$eggveg="";
		$eggveg=0;
	}	
	
	if(isset($_POST['milkveg'])){
		//$milkveg=$_POST['milkveg'];
		$milkveg=1;
	}else{
		//$milkveg="";
		$milkveg=0;
	}
		
	if(isset($_POST['eggmilkveg'])){
		//$eggmilkveg=$_POST['eggmilkveg'];
		$eggmilkveg=1;
	}else{
		//$eggmilkveg="";
		$eggmilkveg=0;
	}
	
	if(isset($_POST['nonspices'])){
		//$nonspices=$_POST['nonspices'];
		$nonspices=1;
	}else{
		//$nonspices="";
		$nonspices=0;
	}
	
	if(isset($_POST['spices'])){
		//$spices=$_POST['spices'];
		$spices=1;
	}else{
		//$spices="";
		$spices=0;
	}
	
	if(isset($_POST['spices1'])){
		//$spices1=$_POST['spices1'];
		$spices1=1;
	}else{
		//$spices1="";
		$spices1=0;
	}
	
	if(isset($_POST['spices2'])){
		//$spices2=$_POST['spices2'];
		$spices2=1;
	}else{
		//$spices2="";
		$spices2=0;
	}
	
	if(isset($_POST['spices3'])){
		//$spices3=$_POST['spices3'];
		$spices3=1;
	}else{
		//$spices3="";
		$spices3=0;
	}
	 
	if(isset($_POST['myFile'])){
		$myfile=$_POST['myFile'];
	}else{
		$myfile="";
	}
/*
echo "点名 :".$kedai."<br>";
echo "圖片 :".$myfile."<br>";
echo "食物名稱 :".$foodName."<br>";
echo "食物簡介 :".$foodIntro."<br>";
echo "價格總結 :".$foodPrice3."<br>";
echo "價格（元） :".$foodPrice1."<br>";
echo "價格（分） :".$foodPrice2."<br>";
echo "內用 :".$indoor."<br>";
echo "外帶 :".$outdoor."<br>";
echo "是否招牌 :".$branded."<br>";
echo "商品備註 :".$remark."<br>";
echo "類別 :".$category."<br>";
echo "子類別 :".$sub_category."<br>";
echo "是否葷 :".$nonveg."<br>";
echo "全素 :".$wholeveg."<br>";
echo "蛋素 :".$eggveg."<br>";
echo "奶素 :".$milkveg."<br>";
echo "蛋奶素 :".$eggmilkveg."<br>";
echo "不辣 :".$nonspices."<br>";
echo "辣 :".$spices."<br>";
echo "小辣 :".$spices1."<br>";
echo "中辣 :".$spices2."<br>";
echo "大辣 :".$spices3."<br>";
echo "上傳時間 :".$date."<br>";
*/
$sql = "INSERT INTO shop_menu (shop_ID, menu_foodname, menu_pictures, menu_describe, menu_price, menu_indoor, menu_outdoor, menu_recommended, menu_remark, menu_category, menu_subCategory, menu_nonveg, menu_wholeveg, menu_eggveg, menu_milkveg, menu_eggmilkveg, menu_nonspices, menu_spices, menu_spices1, menu_spices2, menu_spices3, menu_UploadedTime) VALUES ('$kedai', '$foodName', '$myfile', '$foodIntro', '$foodPrice3', '$indoor', '$outdoor', '$branded', '$remark', '$category', '$sub_category', '$nonveg', '$wholeveg', '$eggveg', '$milkveg', '$eggmilkveg', '$nonspices', '$spices', '$spices1', '$spices2', '$spices3', '$date')"; //date那邊用CURRENT_TIMESTAMP也可以

//$sql = "INSERT INTO food_menu (shop_ID, menu_foodname, menu_pictures) VALUES ('$kedai', '$foodName', '$myfile')"; //date那邊用CURRENT_TIMESTAMP也可以
	if (mysqli_query($link,$sql)) {				
               header("location: productAdd1-2.php");//如果成功的話跑到 productAdd1-2.php
            } else {
               echo "Error: " . $sql . "" . mysqli_error($link);//如果失敗就跳error
	}

	?>