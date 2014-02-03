package eagre.reader.server.app;

import java.util.logging.Logger;

import swarm.server.app.A_ServerApp;
import swarm.server.app.ServerAppConfig;
import swarm.server.handlers.admin.createGrid;
import swarm.server.transaction.E_AdminRequestPath;
import swarm.shared.transaction.E_RequestPath;
import eagre.reader.server.entities.ServerBookGrid;
import eagre.reader.server.homecells.PrototypeCellCreator;
import eagre.reader.shared.app.S_App;

public final class ServerApp extends A_ServerApp
{
	private static final Logger s_logger = Logger.getLogger(ServerApp.class.getName());

	ServerApp()
	{
		super();
		
		ServerAppConfig config = new ServerAppConfig();
		
		config.databaseUrl = "jdbc:google:rdbms://eagrereader:eagrereaderdb/";
		config.accountsDatabase = "er_accounts";
		config.telemetryDatabase = "er_telemetry";
		config.T_homeCellCreator = PrototypeCellCreator.class;
		config.gridExpansionDelta = 1;
		config.startingZ = 128;
		
		config.mainPage = "http://reader.eagreinteractive.com";
		
		config.privateRecaptchaKey = "6LdrmOUSAAAAAEg6K9DUYLIXJ11qBMIYL6qrP8HF";
		config.publicRecaptchaKey = S_App.PUBLIC_RECAPTCHA_KEY;
		
		config.appId = "er";
		
		super.entryPoint(config);
		
		setAdminHandler(new createGrid(ServerBookGrid.class), E_AdminRequestPath.createGrid);
		setNormalHandler(null, E_RequestPath.signUp);
	}
}
