<?php
session_save_path('../session_data');
session_start();
//$kedai=$_SESSION['shop_ID'];
$kedai=1111;
//$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_info要顯示的物件 開始 */
$sql="SELECT * FROM shop_table WHERE shop_ID='$kedai' ORDER BY st_tableNumber ASC";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}

?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>

<body>
<form id="form1" name="form1" method="post">
  <table width="248" border="0" cellspacing="3" cellpadding="4">
    <tbody>
      <tr>
        <td colspan="3">桌子編號新增刪除與修改</td>
      </tr>
      <tr>
        <td width="118" bgcolor="#BACCD3">桌子編號</td>
        <td colspan="2" bgcolor="#BACCD3">新增桌號</td>
      </tr>
		<?php 
			for($i=0; $i<$number_result; $i++){
		?>
      <tr>
        <td bgcolor="#D7E8ED"><?php echo $arr[$i]['st_tableNumber']?></td>
        <td width="47" bgcolor="#D7E8ED">刪除</td>
        <td width="47" bgcolor="#D7E8ED">修改</td>       
      </tr>
		<?php 
			}
		?>
    </tbody>
  </table>
</form>
</body>
</html>