<?php
set_include_path ( get_include_path () . PATH_SEPARATOR . './src' );

require 'ErrorHandler.php';
require 'SimpleLogger.php';

$data = "";
$width = 256;
$height = 256;
$quality = 50;
$kedai="nokedai"; 

if (isset ( $_GET ['data'] ))
{
  $data = urldecode($_GET['data']);
  $data = html_entity_decode( $data, ENT_QUOTES, 'UTF-8' );
}

if (isset($_GET['w']))
{
  $width = intval($_GET['w']);
  if($width < 32 || $width > 256)
    $width = 256;  
}

if (isset($_GET['h']))
{
  $height = intval($_GET['h']);
  if($height < 32 || $height > 256)
    $height = 256;  
}

if (isset($_GET['q']))
{
  $quality = intval($_GET['q']);
  if($quality < 10 || $quality > 100)
  {
    $quality = 50;
  }
}
if (isset($_GET['k']))
{
  $kedai = $_GET['k'];
  
}
if (isset($_GET['t']))
{
  $select = $_GET['t'];
  
}

if ($data)
{
  require_once 'QRErrorCorrectLevel.php';
  require_once 'QRCode.php';
  require_once 'QRCodeImage.php';
  
  try
  {
    $code = new QRCode ( - 1, QRErrorCorrectLevel::H );
    $code->addData ( $data );
    $code->make ();
    
    $img = new QRCodeImage ( $code, $width, $height, $quality );
    $img->draw ();
	$img->store("../image/".$kedai."-".$select.".jpg");//save file
    $imgdata = $img->getImage ();
    $img->finish ();
    
    if ($imgdata)
    {
		
      header ( 'Content-Type: image/jpeg' );
      header ( 'Content-Length: ' . strlen ( $imgdata ) );
      echo $imgdata;
	  
    }
  }
  catch ( Exception $ex )
  {
    SimpleLogger::logException($ex);
  }
}