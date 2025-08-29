<?php
/**
 *
 * @author Vrataski
 * @date 2023-04-26
 */

// This code starts a PHP session and saves the session data to the ../session_data directory.
session_save_path('../session_data');
session_start();

// This code defines two variables: $kedai and $kedai_nama.
$kedai = $_SESSION['shop_ID'];
$kedai_nama = $_SESSION['shop_name'];

// This code includes the connection.php file, which contains the database connection information.
include_once('connection.php');

// This code checks if the add form has been submitted.
if(isset(htmlspecialchars($_POST['add']))){

// This code defines variables for the employee data that was submitted in the add form.
$firstname = htmlspecialchars($_POST['firstname']);
$empStatus = htmlspecialchars($_POST['empStatus']);
$address = htmlspecialchars($_POST['address']);
$empMP = htmlspecialchars($_POST['empMP']);
$empID = htmlspecialchars($_POST['empID']);
$empPass = htmlspecialchars($_POST['empPass']);

// This code creates a SQL INSERT statement to insert the employee data into the employee table.
$sql = "INSERT INTO employee (sol_name, sol_id, sol_pass, sol_status, shop_ID, sol_adrress,sol_hp) VALUES ('$firstname', '$empID', '$empPass', '$empStatus', '$kedai', '$address', '$empMP')";

// This code uses the MySQLi OOP method to execute the SQL INSERT statement.
if($conn->query($sql)){

// This code sets a session variable to indicate that the employee data was added successfully.
$_SESSION['success'] = '職員資料新增成功';
}

// This code checks if the SQL INSERT statement failed.
else{

// This code sets a session variable to indicate that the employee data was not added successfully.
$_SESSION['error'] = '職員資料新增失敗';
}
}

// This code checks if the add form has not been submitted.
else{

// This code sets a session variable to indicate that the user must fill out the add form before adding an employee.
$_SESSION['error'] = '請先填滿資料';
}

// This code redirects the user to the index.php page.
header('location: index.php');
?>