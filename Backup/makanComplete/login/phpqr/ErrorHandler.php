<?php
/**
 * Errorhandler.php
 * @author elad dot yosifon at gmail dot com
 * @see http://php.net/manual/de/function.set-error-handler.php#112881
 * Provides an exception based error handling
 */
/** Exceptions derived from ErrorException **/
class WarningException              extends ErrorException {}
class ParseException                extends ErrorException {}
class NoticeException              extends ErrorException {}
class CoreErrorException            extends ErrorException {}
class CoreWarningException          extends ErrorException {}
class CompileErrorException        extends ErrorException {}
class CompileWarningException      extends ErrorException {}
class UserErrorException            extends ErrorException {}
class UserWarningException          extends ErrorException {}
class UserNoticeException          extends ErrorException {}
class StrictException              extends ErrorException {}
class RecoverableErrorException    extends ErrorException {}
class DeprecatedException          extends ErrorException {}
class UserDeprecatedException      extends ErrorException {}
/**
 * The error handler
 * @param number $err_severity The level or error
 * @param string $err_msg The message of the error
 * @param string $err_file The file where the error has occured
 * @param number $err_line The line where the error has occured
 * @param array $err_context Detailed error description
 */
function application_error_handler($err_severity, $err_msg, $err_file, $err_line, array $err_context)
{
	// error was suppressed with the @-operator
	if (0 === error_reporting()) { return false;}
	switch($err_severity)
	{
		case E_ERROR:              throw new ErrorException            ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_WARNING:            throw new WarningException          ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_PARSE:              throw new ParseException            ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_NOTICE:              throw new NoticeException          ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_CORE_ERROR:          throw new CoreErrorException       ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_CORE_WARNING:        throw new CoreWarningException     ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_COMPILE_ERROR:      throw new CompileErrorException     ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_COMPILE_WARNING:    throw new CoreWarningException      ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_USER_ERROR:          throw new UserErrorException       ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_USER_WARNING:        throw new UserWarningException     ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_USER_NOTICE:        throw new UserNoticeException       ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_STRICT:              throw new StrictException          ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_RECOVERABLE_ERROR:  throw new RecoverableErrorException ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_DEPRECATED:          throw new DeprecatedException      ($err_msg, 0, $err_severity, $err_file, $err_line);
		case E_USER_DEPRECATED:    throw new UserDeprecatedException   ($err_msg, 0, $err_severity, $err_file, $err_line);
		default: 					throw new ErrorException           ($err_msg, 0, $err_severity, $err_file, $err_line);
	}
}

set_error_handler("application_error_handler", E_ALL | E_STRICT);
