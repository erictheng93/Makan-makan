<?php
/**
 * This code generates a PDF file with a table of employee data.
 *
 * @author Vrataski
 * @date 2023-04-26
 */

// Set the default character set to UTF-8.
ini_set('default_charset', 'utf-8');

// Start a session.
session_save_path('../session_data');
session_start();

// Define a function to generate a row of the table.
function generateRow() {
  // Get the shop ID and employee status from the session.
  $kedai = $_SESSION['shop_ID'];
  $emp_status = array("admin", "店主", "廚師", "送菜員", "收銀員");

  // Connect to the database.
  include_once('connection.php');
  mysqli_set_charset($conn, 'utf8');

  // Get the employee data from the database.
  $sql = "SELECT * FROM employee WHERE shop_ID='$kedai'";
  $query = $conn->query($sql);

  // Iterate over the results and create a row for each employee.
  $contents = '';
  while ($row = $query->fetch_assoc()) {
    $contents .= "
      <tr>
        <td>{$row['sol_sn']}</td>
        <td>{$row['sol_name']}</td>
        <td>{$emp_status[$row['sol_status']]}</td>
        <td>{$row['sol_hp']}</td>
      </tr>
    ";
  }

  // Return the contents of the row.
  return $contents;
}

// Get the shop name from the session.
$kedai_nama = $_SESSION['shop_name'];

// Include the TCPDF library.
require_once('tcpdf/tcpdf.php');

// Create a new PDF document.
$pdf = new TCPDF('P', PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);

// Set the document properties.
$pdf->SetCreator(PDF_CREATOR);
$pdf->SetTitle($kedai_nama . "員工資料");
$pdf->SetHeaderData('', '', PDF_HEADER_TITLE, PDF_HEADER_STRING);
$pdf->setHeaderFont(Array(PDF_FONT_NAME_MAIN, '', PDF_FONT_SIZE_MAIN));
$pdf->setFooterFont(Array(PDF_FONT_NAME_DATA, '', PDF_FONT_SIZE_DATA));
$pdf->SetDefaultMonospacedFont('helvetica');
$pdf->SetFooterMargin(PDF_MARGIN_FOOTER);
$pdf->SetMargins(PDF_MARGIN_LEFT, '10', PDF_MARGIN_RIGHT);
$pdf->setPrintHeader(false);
$pdf->setPrintFooter(false);
$pdf->SetAutoPageBreak(TRUE, 10);
$pdf->SetFont('msungstdlight', '', 12);

// Add a new page.
$pdf->AddPage();

// Call the 'generateRow()' function and store the returned HTML string in the variable '$generateRow'
$generateRow = generateRow();

// Create the HTML content for the table.
$content = <<<HTML
<meta http-equiv="Content-type" content="text/html; charset=utf-8" />
{$kedai_nama}<h2 align="center">員工資料</h2>
<h4>Members Table</h4>
<table border="1" cellspacing="0" cellpadding="3">
  <tr>
    <th width="5%">ID</th>
    <th width="20%">使用者名稱</th>
    <th width="20%">使用者職稱</th>
    <th width="55%">使用者手機</th>
  </tr>
{$generateRow}
</table>
HTML;

// Write the HTML content to the PDF document.
$pdf->writeHTML($content);

// Output the PDF document.
$pdf->Output('members.pdf', 'I');

?>