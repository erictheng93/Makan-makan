<?php
	session_start();
	include_once('connection.php');
	//$emp_status=array("admin","店主","廚師","送菜員","收銀員");
	if(isset($_POST['edit'])){
		$id = $_POST['id'];
		$firstname = $_POST['firstname'];
		$empStatus = (int)$_POST['empStatus'];
		//$key = array_search($empStatus, $emp_status);
		$address = $_POST['address'];
		$empMP = $_POST['empMP'];
		$sql = "UPDATE employee SET sol_name = '$firstname', sol_status = '$empStatus', sol_adrress = '$address', sol_hp = '$empMP' WHERE sol_sn = '$id'";

		//use for MySQLi OOP
		if($conn->query($sql)){
			$_SESSION['success'] = '職員資料修改成功'; //如果執行成功，顯示資料修改成功
		}
		///////////////

		//use for MySQLi Procedural
		// if(mysqli_query($conn, $sql)){
		// 	$_SESSION['success'] = 'Member updated successfully';
		// }
		///////////////
		
		else{
			$_SESSION['error'] = '職員資料修改失敗'; //如果執行失敗，顯示資料修改失敗
		}
	}
	else{
		$_SESSION['error'] = '先選擇員工後才修改資料'; //如果沒有選擇，提示先選擇員工資料
	}

	header('location: index.php'); //執行完畢之後跳轉index.php
/**
echo $id."<br>";
echo $firstname."<br>";
echo $empStatus."<br>";
echo $address."<br>";
echo $empMP."<br>";
**/

?>