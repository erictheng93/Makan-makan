<?php
	session_save_path('../session_data');
	session_start();
	$kedai=$_SESSION['shop_ID'];
	$kedai_nama=$_SESSION['shop_name'];
	include_once('connection.php');

	if(isset($_POST['add'])){
		$firstname = $_POST['firstname'];
		$empStatus = $_POST['empStatus'];
		$address = $_POST['address'];
		$empMP = $_POST['empMP'];
		$empID = $_POST['empID'];
		$empPass = $_POST['empPass'];
		$sql = "INSERT INTO employee (sol_name, sol_id, sol_pass, sol_status, shop_ID, sol_adrress,sol_hp) VALUES ('$firstname', '$empID', '$empPass', '$empStatus', '$kedai', '$address', '$empMP')";

		//use for MySQLi OOP
		if($conn->query($sql)){
			$_SESSION['success'] = '職員資料新增成功';
		}
		///////////////

		//use for MySQLi Procedural
		// if(mysqli_query($conn, $sql)){
		// 	$_SESSION['success'] = 'Member added successfully';
		// }
		//////////////
		
		else{
			$_SESSION['error'] = '職員資料新增失敗';
		}
	}
	else{
		$_SESSION['error'] = '請先填滿資料';
	}

	header('location: index.php');
?>