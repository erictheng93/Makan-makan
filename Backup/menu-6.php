<?php 
require "config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_menu菜單要顯示的物件 開始 */
$sql="SELECT * FROM shop_menu WHERE shopMenu_type='6'";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}
/* 選擇shop_menu菜單要顯示的物件 結束 */
?>

<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>湯品</title>
<style type="text/css">
	div {
      background-color: #E1E1E1;		
    }
</style>
</head>

<body>
	<!-- Tab 6 開始	-->
      <div class="tab-content">
		<p>
<!-- Form 開始	-->
        <form id="form2" name="form2" method="post" action="">
<table width="502" border="1" cellspacing="5" cellpadding="5">
  <tr>
	<td width="112" align="center" bgcolor="#66CC33">圖片</td>
	<td width="112" align="center" bgcolor="#66CC33">品名</td>
	<td width="112" align="center" bgcolor="#66CC33">價格</td>
	<td width="112" align="center" bgcolor="#66CC33">選擇</td>
	<td width="112" align="center" bgcolor="#66CC33">數量</td>
	<td width="112" align="center" bgcolor="#66CC33">備註</td>
  </tr>
	
<!--  這裡顯示的是飲料價格和其他  開始 -->
  	<?php for($i=0; $i<$number_result; $i++){ ?>
	<tr>
<!--  這裡顯示的是飲料的圖片  開始 -->
		<td><img src="image/<?php echo $arr[$i]['shopMenu_pictures'] ?>" onerror="this.onerror=null; this.src='./image/sorry.jpg'" alt="目前沒有圖片" width="140" height="94" /></td>
<!--  這裡顯示的是飲料的圖片  結束 -->
		
<!--  這裡顯示的是飲料的名稱  開始 -->
		<td><?php echo $arr[$i]['shopMenu_name'] ?></td>
<!--  這裡顯示的是飲料的名稱  結束 -->
	  
<!--  這裡顯示的是飲料的價格  開始 -->
	<td><?php echo $arr[$i]['shopMenu_price'] ?></td>
<!--  這裡顯示的是飲料的價格  結束 -->

<!--  這裡顯示的是飲料的選擇按鈕  開始 -->
    <td>
      <input type="checkbox" name="checkbox1" id="checkbox1" />
      <label for="checkbox"></label>
    </td>
<!--  這裡顯示的是飲料的選擇按鈕  結束 -->

<!--  這裡顯示的是飲料的備註  開始 -->
    <td><input type="number" name="quantity" min="1" max="5" placeholder="1" pattern="[0-5]+"></td>
<!--  這裡顯示的是飲料的備註  結束 -->
		
<!--  這裡顯示的是飲料的備註  開始 -->
    <td><?php echo $arr[$i]['shopMenu_remark'] ?></td>
<!--  這裡顯示的是飲料的備註  結束 -->
  	</tr>
<?php } ?>
<!--  這裡顯示的是飲料價格和其他  結束 -->
</table>
<input type="submit" value="加入菜單" class="btn btn-primary">
<input type="reset" value="重新選擇" class="btn btn-primary">
</form>
        </p>
      </div>
<!-- Tab 6 結束	-->
</body>
</html>