package eagre.reader.client.app;

public class S_ClientApp
{
	public static final int FRAMERATE = 33; // milliseconds between frames
	
	public static final int CODE_CACHE_SIZE = 128;
	public static final double CODE_CACHE_EXPIRATION = 60 * 5; // seconds;
	
	public static final int ADDRESS_CACHE_SIZE = 1024;
	public static final double ADDRESS_CACHE_EXPIRATION = 60 * 5;
	
	public static final int MAGIC_UI_SPACING = 4;
	
	public static final int CELL_HUD_HEIGHT = 46;
	
	public static final int MAX_HISTORY = 128;
	
	public static final double MIN_SNAP_TIME = .8;

	public static final double MAX_SNAP_TIME = 1.75;
	
	public static final double SET_HISTORY_STATE_MIN_FREQUENCY = .75;
	
	public static final double SNAP_TIME_RANGE = MAX_SNAP_TIME - MIN_SNAP_TIME;
	
	public static final double VIEWING_CELL_CLOSE_BUTTON_DISTANCE_OFFSET = 100;
	
	public static final String APP_ID = "bh";
}
