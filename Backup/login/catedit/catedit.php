<?php

session_save_path('../session_data');
session_start();
$kedai=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];

require "../../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_info要顯示的物件 開始 */
$sql="SELECT * FROM category";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
while($savedResult = mysqli_fetch_array($result)) {
  	$OriginArrayName[] = $savedResult[1];
	$OriginArrayID[] = $savedResult[0];
}
//print_r($OriginArrayID);
$lenOriginArrayName=count($OriginArrayName);

$sql2="SELECT shop_category FROM shop_info WHERE shop_ID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
while($savedResult2 = mysqli_fetch_array($result2)) {
  $ShopCat = $savedResult2[0];
}
$ShopArray= explode(',',$ShopCat);//Split a comma-delimited string into an array


$sql3="SELECT * FROM shop_table WHERE shop_ID='$kedai' ORDER BY st_tableNumber ASC";//搜索資料指令 捉取數據庫裡Banner的資料
$result3=mysqli_query($link,$sql3);//執行指令,並把結果存到result
$number_result3=mysqli_num_rows($result3);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result3; $i++){
$arr3[$i]=mysqli_fetch_array($result3);
}
?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>
	
<style type="text/css">
	.box1 {
		float: left;
		width: 80%;
		margin-right: 5%;
		border: 2px solid  #D5D1D1;
		border-radius: 2px;
		padding: 10px;
		box-shadow: 0px 5px 10px 0px #aaa;
	}
	.box2 {
		float: left;
		width: 80%;
		margin-right: 5%;
		border: 2px solid  #D5D1D1;
		border-radius: 2px;
		padding: 10px;
		box-shadow: 0px 5px 10px 0px #aaa;
		margin-top: 20px;
	}
	
	.box3 {
		position:relative;
		margin-top: 20px;
		float: left;
		width: 80%;
		margin-right: 5%;
		border: 2px solid  #D5D1D1;
		border-radius: 2px;
		padding: 10px;
		box-shadow: 0px 5px 10px 0px #aaa;
		height: 300px;
		
	}
</style>
	
	
<body>
	<div class="box1">
		<h3><?php echo $kedai_nama?>--食物類別新增與修改</h3>
		<form id="form1" name="form1" method="post" action="savecat.php">

	  <?php 
	  	for($i=0;$i<$lenOriginArrayName;$i++){
			$ii=$i+1;
			$key = array_search($ii, $ShopArray);
			
			if(strlen($key)>0){ 
		?>
	  <input name="Checkbox[]" type="checkbox" id="CheckboxGroup1_0" value="<?php echo $OriginArrayID[$i] ?>" checked="checked">
       <?php echo $OriginArrayName[$i] ?>&nbsp;&nbsp;&nbsp;&nbsp;
	  
	  
	  <?php
			}else{
		?>	
	  <input name="Checkbox[]" type="checkbox" id="CheckboxGroup1_0" value="<?php echo $OriginArrayID[$i] ?>">
      <?php echo $OriginArrayName[$i] ?>&nbsp;&nbsp;&nbsp;&nbsp;
	  			
		<?php		
			}
		} 
	  	?>
    	<br>
    	<input type="submit" name="submit" id="submit" value="送出">
    	<br>

		</form>
	</div>
	<p>
	
	<div class="box2">
	<form id="form1" name="form1" method="post">
		  <table width="248" border="0" cellspacing="3" cellpadding="4">
			<tbody>
			  <tr>
				<td colspan="3">桌子編號新增刪除與修改</td>
			  </tr>
			  <tr>
				<td width="118" bgcolor="#BACCD3">桌子編號</td>
				<td colspan="2" bgcolor="#BACCD3"><a href="newcate.php?newcate=<?php echo $arr3[$i]['st_sn'] ?>">新增桌號</a></td>
			  </tr>
				<?php 
					for($i=0; $i<$number_result3; $i++){
				?>
			  <tr>
				<td bgcolor="#D7E8ED"><?php echo $arr3[$i]['st_tableNumber']?></td>				
				<td width="47" bgcolor="#D7E8ED"><a href="editcate.php?editcate=<?php echo $arr3[$i]['st_sn'] ?>">修改</a></td>
				<td width="47" bgcolor="#D7E8ED">
					<a href="deletecate.php?deletecate=<?php echo $arr3[$i]['st_sn'] ?>" onClick="return confirm('確定刪除此資料？')">刪除</a></td>
			  </tr>
				<?php 
					}
				?>
			</tbody>
		  </table>
	</form>
	</div>	
	<div class="box3">
		<iframe style='display:block;top:0;left:0;position:absolute;width:100%;height:100%;' frameborder='0' src="menuPost.php" allowfullscreen="true" name="iframe_a"	></iframe>
	</div>
</body>
</html>