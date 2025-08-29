<?php 
error_reporting( error_reporting() & ~E_NOTICE );
$id_input=$_POST['id_input']; //把登錄者的賬號送過來
$pass_input=$_POST['pass_input']; //把登錄者的密碼送過來


require "../config.php";//include config.php
$sql="SELECT * FROM shopowner_login WHERE sol_id='$id_input' AND sol_pass='$pass_input'";//搜索資料指令
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數

/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}
$b=$arr[0]['sol_name']; //使用者名稱
$c=$arr[0]['sol_id']; //序號
$d=$arr[0]['sol_status']; //使用者权限

if($number_result>0){ 
	session_save_path("session_data"); //把成功login之後的session存在session data裡面
	session_start(); //Session開始
	$_SESSION['check']="ok"; //這個是看你登入的賬號密碼能不能對應到你SQL裡面所儲存的賬號密碼。這邊的session check是讓經過認證的管理人員可以登入進去
	$_SESSION['m_name']="$b"; //使用者名稱
	$_SESSION['m_id']="$c"; //使用者序號
	$_SESSION['status']="$d"; //使用者权限	
	
	header("location: backend.php"); //經過session check ok，對應到的話就成功進去backend.php
} else {
	header("location: login.php?no=1"); //經過session check如果對應不到的話，就redirect回去login.php並顯示出if($_GET['no']==1的區塊
}
?>
