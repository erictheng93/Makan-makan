<?php
declare(strict_types=1);
?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>
	
<style type="text/css">
 .drop-zone {
  max-width: 200px;
  height: 150px;
  padding: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-family: "Quicksand", sans-serif;
  font-weight: 500;
  font-size: 20px;
  cursor: pointer;
  color: #cccccc;
  border: 2px dashed #009578;
  border-radius: 10px;
}

.drop-zone--over {
  border-style: solid;
}

.drop-zone__input {
  display: none;
}

.drop-zone__thumb {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  background-color: #cccccc;
  background-size: cover;
  position: relative;
}

.drop-zone__thumb::after {
  content: attr(data-label);
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 5px 0;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.75);
  font-size: 14px;
  text-align: center;
}
 </style> 
	<?php
	
		
	if(isset($_POST['category'])){
		$category=htmlspecialchars($_POST['category']);
	}else{
		$category="";
	}
	
	require "../../config.php";
	mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
	/* 選擇shop_info要顯示的物件 開始 */
	$sql="SELECT category from category";//搜索資料指令 捉取數據庫裡Banner的資料
	$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
	$menuOrigin = [];
	foreach($result as $row) {
    $menuOrigin[] = $row['category'];
	}
	
	
	
	if(isset($_POST['sub-category'])){
		$sub_category=htmlspecialchars($_POST['sub-category']);
	}else{
		$sub_category="";
	}
	
	/* 選擇shop_info要顯示的物件 開始 */
	$sql2="SELECT subcategory from subcategory";//搜索資料指令 捉取數據庫裡Banner的資料
	$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
	$menuOrigin2 = [];
	foreach($result2 as $row) {
    $menuOrigin2[] = $row['subcategory'];
	} 
	
	
	if(isset($_POST['foodName'])){
		$foodName=htmlspecialchars($_POST['foodName']);
	}else{
		$foodName="";
	}
	
	if(isset($_POST['foodIntro'])){
		$foodIntro=htmlspecialchars($_POST['foodIntro']);
	}else{
		$foodIntro="";
	}
	
	if(isset($_POST['foodPrice1'])){
		$foodPrice1=htmlspecialchars($_POST['foodPrice1']);
	}else{
		$foodPrice1="";
	}
	
	if(isset($_POST['foodPrice2'])){
		$foodPrice2=htmlspecialchars($_POST['foodPrice2']);
	}else{
		$foodPrice2="";
	}
	
	if(isset($_POST['indoor'])){
		$indoor=htmlspecialchars($_POST['indoor']);
		$indoorCheck='checked="checked"';
	}else{
		$indoor="";
		$indoorCheck='';
	}
	
	if(isset($_POST['outdoor'])){
		$outdoor=htmlspecialchars($_POST['outdoor']);
		$outdoorCheck='checked="checked"';
	}else{
		$outdoor="";
		$outdoorCheck="";
	}
	
	if(isset($_POST['nonveg'])){
		$nonveg=htmlspecialchars($_POST['nonveg']);
		$nonvegCheck='checked="checked"';
	}else{
		$nonveg="";
		$nonvegCheck='';
	}
	
	if(isset($_POST['wholeveg'])){
		$wholeveg=htmlspecialchars($_POST['wholeveg']);
		$wholevegCheck='checked="checked"';
	}else{
		$wholeveg="";
		$wholevegCheck='';
	}
	
	if(isset($_POST['eggveg'])){
		$eggveg=htmlspecialchars($_POST['eggveg']);
		$eggvegCheck='checked="checked"';
	}else{
		$eggveg="";
		$eggvegCheck='';
	}
	
	if(isset($_POST['milkveg'])){
		$milkveg=htmlspecialchars($_POST['milkveg']);
		$milkvegCheck='checked="checked"';
	}else{
		$milkveg="";
		$milkvegCheck='';
	}
	
	if(isset($_POST['eggmilkveg'])){
		$eggmilkveg=htmlspecialchars($_POST['eggmilkveg']);
		$eggmilkvegCheck='checked="checked"';
	}else{
		$eggmilkveg="";
		$eggmilkvegCheck='';
	}
	
	if(isset($_POST['nonspices'])){
		$nonspices=htmlspecialchars($_POST['nonspices']);
		$nonspicesCheck='checked="checked"';
	}else{
		$nonspices="";
		$nonspicesCheck='';
	}
	
	if(isset($_POST['spices'])){
		$spices=htmlspecialchars($_POST['spices']);
		$spicesCheck='checked="checked"';
	}else{
		$spices="";
		$spicesCheck='';
	}
	
	if(isset($_POST['spices1'])){
		$spices1=htmlspecialchars($_POST['spices1']);
		$spices1Check='checked="checked"';
	}else{
		$spices1="";
		$spices1Check='';
	}
	
	if(isset($_POST['spices2'])){
		$spices2=htmlspecialchars($_POST['spices2']);
		$spices2Check='checked="checked"';
	}else{
		$spices2="";
		$spices2Check='';
	}
	
	if(isset($_POST['spices3'])){
		$spices3=htmlspecialchars($_POST['spices3']);
		$spices3Check='checked="checked"';
	}else{
		$spices3="";
		$spices3Check='';
	}
	
	if(isset($_POST['branded'])){
		$branded=htmlspecialchars($_POST['branded']);
		$brandedCheck='checked="checked"';
	}else{
		$branded="";
		$brandedCheck="";
	}
	
	if(isset($_POST['remark'])){
		$remark=htmlspecialchars($_POST['remark']);		
	}else{
		$remark="";		
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
/**---    image upload           ---**/
	
	date_default_timezone_set("Asia/Taipei");
$d=date("Ymdhis"); 
# 檢查檔案是否上傳成功
if ($_FILES['myFile']['error'] === UPLOAD_ERR_OK){
  
   	$userfile_name = $_FILES['myFile']['name'];
    	$file = $_FILES['myFile']['tmp_name'];
		$userfile_extn = substr($userfile_name, strrpos($userfile_name, '.')+1);
		$newFilename=$d.".".$userfile_extn;
		$newFilename2=$d."s.".$userfile_extn;
   		$dest = 'image/' .$newFilename;
		$save = "image/" . $newFilename2; 
		move_uploaded_file($file, $dest);
	$file = "image/" . $newFilename; 
		list($width, $height) = getimagesize($file) ;
		$modwidth = 100;//最後寬度
		$diff = $width / $modwidth; //原寬度/最後寬 -比率
		$modheight = $height / $diff;//新高度==原高度/比率
		$tn = imagecreatetruecolor($modwidth, $modheight) ;
        $image = imagecreatefromjpeg($file) ;
        imagecopyresampled($tn, $image, 0, 0, 0, 0, $modwidth, $modheight, $width, $height) ;
        imagejpeg($tn, $save, 100) ;
	}else{
  		//echo '錯誤代碼：' . $_FILES['myFile']['error'] . '<br/>'; 
		$none="沒有照片";
	}
	
	
	
	?>
<body>
	確認食物新增
<form id="form1" name="form1" method="post" action="savedata.php" enctype="multipart/form-data">
  <table width="927" border="0" cellspacing="3" cellpadding="4">
    <tbody>
      <tr>
        <td width="91" bgcolor="#AECAD3">&nbsp;</td>
        <td width="298" bgcolor="#AECAD3">主類別</td>
        <td width="168" bgcolor="#AECAD3">次類別</td>
        <td width="323" bgcolor="#94B9C5">食物名稱</td>
      </tr>
      <tr>
        <td bgcolor="#94B9C5">食物類別</td>
        <td>
		<!--  start cascadate select menu                    -->
			<input type="text" name="category" id="textfield4" value="<?php echo $category?>" hidden><?php echo $menuOrigin[$category-1]?>
		</td>
        <td>
			<input type="text" name="sub_category" id="textfield5" value="<?php echo $sub_category?>" hidden><?php echo $menuOrigin2[$sub_category-1]?>
			
		</td>
        <td><input name="foodName" type="text" id="textfield" size="40" value="<?php echo $foodName ?>" hidden><?php echo $foodName ?></td>
      </tr>
      <tr>
        <td valign="top" bgcolor="#94B9C5">食物簡介</td>
        <td ><textarea name="foodIntro" cols="40" rows="14" id="textarea" readonly><?php echo $foodIntro ?></textarea></td>
		<td valign="top" bgcolor="#94B9C5">圖片</td>
        <td>
<!---------照上上傳--------------->	
			<?php if(isset($newFilename2)){?>
		   	<input name="myFile" type="text" id="textfield6" size="40" value="<?php echo $newFilename2 ?>" hidden>
			<img src="image/<?php echo $newFilename2 ?>">
			<?php }else{?>
			<input name="myFile" type="text" id="textfield6" size="40"  hidden>
			<?php echo $none ?>
			<?php }?>
<!---------照上上傳--------------->			   	   
		</td>
      </tr>
	   <tr>
        
		<td bgcolor="#94B9C5">辣度</td>
        <td>
			<input name="nonspices" type="checkbox" id="checkbox4" <?php echo $nonspicesCheck ?> onclick="return false" >
        		<label for="checkbox4">不辣 <br></label>
			<input type="checkbox" name="spices" id="checkbox5" <?php echo $spicesCheck ?> onclick="return false">
   		  		<label for="checkbox5">辣 :</label>
		  <input type="checkbox" name="spices1" id="checkbox6" <?php echo $spices1Check ?> onclick="return false">
        		<label for="checkbox6">大辣 </label>
			<input type="checkbox" name="spices2" id="checkbox7" <?php echo $spices2Check ?> onclick="return false">
        		<label for="checkbox7">中辣 </label>
			<input type="checkbox" name="spices3" id="checkbox8" <?php echo $spices3Check ?> onclick="return false">
        		<label for="checkbox8">小辣 </label>
		</td>
		<td bgcolor="#94B9C5">葷/素</td>
        <td>
				<label for="checkbox9"> </label>
          	<input name="nonveg" type="checkbox" id="checkbox9" <?php echo $nonvegCheck ?> onclick="return false">
          		<label for="checkbox9">葷 </label>
          	<input type="checkbox" name="wholeveg" id="checkbox10" <?php echo $wholevegCheck ?> onclick="return false">
          		<label for="checkbox10">全素</label>
          	<input type="checkbox" name="eggveg" id="checkbox11" <?php echo $eggvegCheck ?> onclick="return false">
          		<label for="checkbox11">蛋素</label>
          		<br>
          	<input type="checkbox" name="milkveg" id="checkbox12" <?php echo $milkvegCheck ?> onclick="return false">
          		<label for="checkbox12">奶素</label>
          	<input type="checkbox" name="eggmilkveg" id="checkbox13" <?php echo $eggmilkvegCheck ?> onclick="return false">
        		<label for="checkbox13">蛋奶素</label>
		</td>
      </tr>
      <tr>
        <td bgcolor="#94B9C5">價格</td>
        <td>$
          	<input name="foodPrice1" type="text" id="textfield2" size="10" value="<?php echo $foodPrice1 ?>" hidden>
          	<input name="foodPrice2" type="text" id="textfield3" size="10" value="<?php echo $foodPrice2 ?>" hidden><?php echo $foodPrice3 ?>元
		</td>
        <td bgcolor="#94B9C5">外/內</td>
        <td>
			<input name="indoor" type="checkbox" id="checkbox1" <?php echo $indoorCheck ?> onclick="return false">
        		<label for="checkbox1">內用</label>
			<input type="checkbox" name="outdoor" id="checkbox2" <?php echo $outdoorCheck ?> onclick="return false">
        		<label for="checkbox2">外帶</label>
		</td>
      </tr>
      <tr>
        <td height="32" bgcolor="#94B9C5">招牌菜</td>
        <td>
			<input type="checkbox" name="branded" id="checkbox3" <?php echo $brandedCheck ?> onclick="return false">
            	<label for="checkbox3">是</label>
		</td>
        <td align="right" bgcolor="#94B9C5">
			商品備註
		  </td>
        <td align="left" bgcolor="#FFFFFF"><textarea name="remark" cols="40" id="textarea2"><?php echo $remark ?></textarea></td>
      </tr>
	  <tr> 
        <td colspan="2" align="left" bgcolor="#4B8498"><input type="reset" name="reset" id="reset" value="重設"></td>
        <td colspan="2" align="right" bgcolor="#4B8498"><input type="submit" name="submit" id="submit" value="送出"></td>
      </tr>	
    </tbody>
	  
  </table>
</form>

</body>
</html>