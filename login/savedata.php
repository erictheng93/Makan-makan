<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>

<body>
	<?php
	if(isset($_POST['category'])){
		$category=$_POST['category'];
	}else{
		$category="";
	}
	
	if(isset($_POST['sub-category'])){
		$sub_category=$_POST['sub-category'];
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
	
	if(isset($_POST['indoor'])){
		$indoor=$_POST['indoor'];
	}else{
		$indoor="";
	}
	
	if(isset($_POST['outdoor'])){
		$outdoor=$_POST['outdoor'];
	}else{
		$outdoor="";
	}
	
	if(isset($_POST['nonveg'])){
		$nonveg=$_POST['nonveg'];
	}else{
		$nonveg="";
	}
	
	if(isset($_POST['wholeveg'])){
		$wholeveg=$_POST['wholeveg'];
	}else{
		$wholeveg="";
	}
	
	if(isset($_POST['eggveg'])){
		$eggveg=$_POST['eggveg'];
	}else{
		$eggveg="";
	}
	
	if(isset($_POST['milkveg'])){
		$milkveg=$_POST['milkveg'];
	}else{
		$milkveg="";
	}
	
	if(isset($_POST['eggmilkveg'])){
		$eggmilkveg=$_POST['eggmilkveg'];
	}else{
		$eggmilkveg="";
	}
	
	if(isset($_POST['nonspices'])){
		$nonspices=$_POST['nonspices'];
	}else{
		$nonspices="";
	}
	
	if(isset($_POST['spices'])){
		$spices=$_POST['spices'];
	}else{
		$spices="";
	}
	
	if(isset($_POST['spices1'])){
		$spices1=$_POST['spices1'];
	}else{
		$spices1="";
	}
	
	if(isset($_POST['spices2'])){
		$spices2=$_POST['spices2'];
	}else{
		$spices2="";
	}
	
	if(isset($_POST['spices3'])){
		$spices3=$_POST['spices3'];
	}else{
		$spices3="";
	}

	echo "Category :". $category. "<br>";
	echo "Sub-category :". $sub_category. "<br>";
	echo "foodName :". $foodName. "<br>";
	echo "foodIntro :". $foodIntro. "<br>";
	echo "foodPrice :". $foodPrice1.".".$foodPrice2."<br>";
	echo "indoor :". $indoor. "<br>";
	echo "outdoor :". $outdoor. "<br>";
	echo "nonveg :". $nonveg. "<br>";
	echo "wholeveg :". $wholeveg. "<br>";
	echo "eggveg :". $eggveg. "<br>";
	echo "milkveg :". $milkveg. "<br>";
	echo "eggmilkveg :". $eggmilkveg. "<br>";
	echo "nonspices :". $nonspices. "<br>";
	echo "spices :". $spices. "<br>";
	echo "spices1 :". $spices1. "<br>";
	echo "spices2 :". $spices2. "<br>";
	echo "spices3 :". $spices3. "<br>";

/**---    image upload           ---**/
	
	date_default_timezone_set("Asia/Taipei");
$d=date("Ymdhis"); 
# 檢查檔案是否上傳成功
if ($_FILES['myFile']['error'] === UPLOAD_ERR_OK){
  
   # 檢查檔案是否已經存在
	 // if (file_exists('image/' . $_FILES['myFile']['name'])){
//echo '檔案已存在。<br/>';
	 // } else {
		$userfile_name = $_FILES['myFile']['name'];
    	$file = $_FILES['myFile']['tmp_name'];
		$userfile_extn = substr($userfile_name, strrpos($userfile_name, '.')+1);
		$newFilename=$d.".".$userfile_extn;
		$newFilename2=$d."s.".$userfile_extn;
   		$dest = 'image/' .$newFilename;
		$save = "image/" . $newFilename2; 
		move_uploaded_file($file, $dest);
	echo '檔案名稱: ' . $_FILES['myFile']['name'] . '<br/>';
	echo '檔案新名稱: ' . $newFilename . '<br/>';
  	echo '檔案類型: ' . $_FILES['myFile']['type'] . '<br/>';
  	echo '檔案大小: ' . ($_FILES['myFile']['size'] / 1024) . ' KB<br/>';
  	echo '暫存名稱: ' . $_FILES['myFile']['tmp_name'] . '<br/>';	
		
		$file = "image/" . $newFilename; 
		list($width, $height) = getimagesize($file) ;
		$modwidth = 100;//最後寬度
		$diff = $width / $modwidth; //原寬度/最後寬 -比率
		$modheight = $height / $diff;//新高度==原高度/比率
		$tn = imagecreatetruecolor($modwidth, $modheight) ;
        $image = imagecreatefromjpeg($file) ;
        imagecopyresampled($tn, $image, 0, 0, 0, 0, $modwidth, $modheight, $width, $height) ;
        imagejpeg($tn, $save, 100) ;
		
		echo "small image: <img src='image/".$newFilename2."'><br>";
		# 將檔案移至指定位置
		
	 // }
}else{
  echo '錯誤代碼：' . $_FILES['myFile']['error'] . '<br/>'; 
}
	?>
</body>
</html>