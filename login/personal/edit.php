<?php
/**
 *
 * @author Vrataski
 * @date 2023-04-26
 */

// This code starts a PHP session.
session_start();

// This code includes the connection.php file, which contains the database connection information.
include_once('connection.php');

// This code defines an array of employee statuses: $emp_status.
$emp_status = array("admin","店主","廚師","送菜員","收銀員");

// This code checks if the edit form has been submitted.
if(isset($_POST['edit'])){

    // This code defines variables for the employee data that was submitted in the edit form.
    $id = htmlspecialchars($_POST['id']);
    $firstname = htmlspecialchars($_POST['firstname']);
    $empStatus = htmlspecialchars((int)$_POST['empStatus']);
    $address = htmlspecialchars($_POST['address']);
    $empMP = htmlspecialchars($_POST['empMP']);

    // This code creates a SQL UPDATE statement to update the employee data in the employee table.
    $sql = "UPDATE employee SET sol_name = ?, sol_status = ?, sol_adrress = ?, sol_hp = ? WHERE sol_sn = ?";

    // Prepare the SQL statement
    if($stmt = $conn->prepare($sql)){

        // Bind parameters
        $stmt->bind_param("sisss", $firstname, $empStatus, $address, $empMP, $id);

        // Execute the prepared statement
        if($stmt->execute()){

            // This code sets a session variable to indicate that the employee data was updated successfully.
            $_SESSION['success'] = '職員資料修改成功';
        }
        else{
            // This code sets a session variable to indicate that the employee data was not updated successfully.
            $_SESSION['error'] = '職員資料修改失敗';
        }
    }
    else{
        // This code sets a session variable to indicate that the employee data was not updated successfully.
        $_SESSION['error'] = '職員資料修改失敗';
    }
}
else{
    // This code sets a session variable to indicate that the user must select an employee before editing their data.
    $_SESSION['error'] = '先選擇員工後才修改資料';
}

// This code redirects the user to the index.php page.
header('location: index.php');
?>
