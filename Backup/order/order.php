<!doctype html>
<?php
session_save_path('../session_data');
session_start();
$food=$_GET['a'];
require "../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
$sql0="SELECT * FROM shop_menu WHERE menu_sn='$food'";//搜索訂單資料指令 捉取數據庫裡Banner的資料
$result0=mysqli_query($link,$sql0);//執行指令,並把結果存到result
$number_result0=mysqli_num_rows($result0);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result0; $i++){
$arr0[$i]=mysqli_fetch_array($result0);
}
?>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>
<style type="text/css">
	body {
		background-color:#B6E4F3;
	}
</style>
<body>
<form id="form1" name="form1" method="post" action="saveorder.php">
  <table width="210" border="0" cellspacing="3" cellpadding="4">
	  <tr>
        <td width="98">餐點:</td>
        <td width="87"><input type="hidden" name="menu_foodname" value="<?php echo $arr0[0]['menu_foodname']?>"><input type="hidden" name="shopmenu_sn" value="<?php echo $arr0[0]['menu_sn']?>"><?php echo $arr0[0]['menu_foodname']?></td>
      </tr>
      <tr>
        <td>價格:</td>
        <td><input type="hidden" name="menu_price" value="<?php echo $arr0[0]['menu_price']?>"><?php echo $arr0[0]['menu_price']?></td>
      </tr>
      <tr>
        <td>數量:</td>
        <td><select name="num_select" id="select">       
          <option value="1" selected>1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
          <option value="7">7</option>
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
          <option value="11">11</option>
          <option value="12">12</option>
          <option value="13">13</option>
          <option value="14">14</option>
          <option value="15">15</option>
          <option value="16">16</option>
          <option value="17">17</option>
          <option value="18">18</option>
          <option value="19">19</option>
          <option value="20">20</option>
        </select></td>
      </tr>
      <tr>
        <td>加辣 </td>
        <td><input type="checkbox" name="checkbox1" id="checkbox"></td>
      </tr>
	  <tr>
        <td>加量(+10元)</td>
        <td><input type="checkbox" name="checkbox2" id="checkbox"></td>
      </tr>
	  <tr>
        <td>加蛋(+10元)</td>
        <td><input type="checkbox" name="checkbox3" id="checkbox"></td>
      </tr>
		<tr>
        <td>&nbsp;</td>
        <td align="right"><input type="hidden" name="foodorder" value=$food><input type="submit" name="submit" id="submit" value="送出"></td>
      </tr>
	<!---	<a onclick="parent.document.getElementById('id01').style.display='none'" href="#" >Call Me </a> -->
    
  </table>
</form>
</body>
</html>