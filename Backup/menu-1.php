<?php 
require "config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_menu菜單要顯示的物件 開始 */
$sql="SELECT * FROM shop_menu WHERE shopMenu_type='1'";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}
/* 選擇shop_menu菜單要顯示的物件 結束 */

/* 選擇shop_table 開始 */
//$sql="SELECT * FROM shop_table WHERE shop_ID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
//$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
//$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
///*  查詢結轉成果array             */
//for($i=0; $i<$number_result; $i++){
//$arr[$i]=mysqli_fetch_array($result);
//}
/* 選擇shop_table 結束 */
?>

<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>主食</title>
<style type="text/css">
	div {
      background-color: #E1E1E1;		
    }
</style>
</head>

<body>
<!-- Tab 1 開始	-->
<div class="tab-content">
      <p>
<!-- Form 開始	-->
<form id="form1" name="form1" method="post" action="">
<table width="502" border="1" cellspacing="5" cellpadding="5">
  <tr>
	<td width="112" align="center" bgcolor="#66CC33">圖片</td>
	<td width="112" align="center" bgcolor="#66CC33">品名</td>
	<td width="112" align="center" bgcolor="#66CC33">價格</td>
	<td width="112" align="center" bgcolor="#66CC33">選擇</td>
	<td width="112" align="center" bgcolor="#66CC33">數量</td>
	<td width="112" align="center" bgcolor="#66CC33">備註</td>
  </tr>
	
<!--  這裡顯示的是食物商品價格和其他  開始 -->
  	<?php for($i=0; $i<$number_result; $i++){ ?>
	<tr>
<!--  這裡顯示的是食物的圖片  開始 -->
		<td><input type="hidden" name="productPictures"><img src="image/<?php echo $arr[$i]['shopMenu_pictures']?>" onerror="this.onerror=null; this.src='./image/sorry.jpg'" alt="目前沒有圖片" width="140" height="94"/></td>
<!--  這裡顯示的是食物的圖片  結束 -->
		
<!--  這裡顯示的是食物的名稱  開始 -->
		<td><input type="hidden" name="productName"><?php echo $arr[$i]['shopMenu_name'] ?></td>
<!--  這裡顯示的是食物的名稱  結束 -->
	  
<!--  這裡顯示的是食物的價格  開始 -->
	<td><input type="hidden" name="productPrice"><?php echo $arr[$i]['shopMenu_price'] ?></td>
<!--  這裡顯示的是食物的價格  結束 -->

<!--  這裡顯示的是食物的選擇按鈕  開始 -->
    <td>
      <input type="checkbox" name="checkboxgroup[]" id="checkboxgroup" />
<!--      <label for="checkbox"></label>-->
    </td>
<!--  這裡顯示的是食物的選擇按鈕  結束 -->

<!--  這裡顯示的是食物的備註  開始 -->
    <td><input type="number" name="productQuantity" min="1" max="5" placeholder="1" pattern="[0-5]+"></td>
<!--  這裡顯示的是食物的備註  結束 -->
		
<!--  這裡顯示的是食物的備註  開始 -->
    <td><input type="hidden" name="productRemark"><?php echo $arr[$i]['shopMenu_remark'] ?></td>
<!--  這裡顯示的是食物的備註  結束 -->
  	</tr>
<?php } ?>
<!--  這裡顯示的是食物商品價格和其他  結束 -->
</table>
<input type="submit" value="加入菜單" name="submit" class="btn btn-primary">
<input type="reset" value="重新選擇" name="reset" class="btn btn-primary">
</form>
        </p>
      </div>
<!-- Tab 1 結束	-->
	
	主食----HTML iframe 是框架的一種，也稱為內置框架或內聯框架，用來在網頁內嵌入另外一個網頁，例如現在非常流行的嵌入 Facebook 粉絲團到部落格或個人網站、在網站內容加上按讚或分享的按鈕都是常見的應用方式，HTML iframe 可以自己設定要嵌入的網頁所佔空間，如寬度與高度，也可以設定是否要顯示邊框或捲軸，幾乎所有主流的瀏覽器都支援 HTML iframe 框架語法。
</body>
</html>