<?php 
error_reporting( error_reporting() & ~E_NOTICE );
$id_input=$_POST['id_input']; //把登錄者的賬號送過來
$pass_input=$_POST['pass_input']; //把登錄者的密碼送過來


require "../config.php";//include config.php
$sql="SELECT * FROM employee WHERE sol_id='$id_input' AND sol_pass='$pass_input'";//搜索資料指令
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數

/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}
$sol_name=$arr[0]['sol_name']; //使用者名稱
$sol_status=$arr[0]['sol_status']; //使用者权限
$sol_sn=$arr[0]['sol_sn']; //序號
$shop_ID=$arr[0]['shop_ID']; //序號

/*                    */
$sql2="SELECT * FROM shop_info WHERE shop_ID='$shop_ID'";//搜索資料指令
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數

/*  查詢結轉成果array             */
for($i=0; $i<$number_result2; $i++){
$arr2[$i]=mysqli_fetch_array($result2);
}
$shop_name=$arr2[0]['shop_name']; //序號

if($number_result>0){ 
	session_save_path("session_data"); //把成功login之後的session存在session data裡面
	session_start(); //Session開始
	$_SESSION['check']="ok"; //這個是看你登入的賬號密碼能不能對應到你SQL裡面所儲存的賬號密碼。這邊的session check是讓經過認證的管理人員可以登入進去
	$_SESSION['status']="$sol_status"; //使用者权限
	$_SESSION['m_name']="$sol_name"; //使用者名稱
	$_SESSION['m_id']="$sol_sn"; //使用者序號
	$_SESSION['m_id']="$sol_sn"; //使用者序號
	$_SESSION['shop_ID']="$shop_ID"; //使用者店代碼
	$_SESSION['shop_name']="$shop_name"; //使用者店代碼
	
	header("location: index2.php"); //經過session check ok，對應到的話就成功進去backend.php
} else {
	header("location: login.php?no=1"); //經過session check如果對應不到的話，就redirect回去login.php並顯示出if($_GET['no']==1的區塊
}
?>
