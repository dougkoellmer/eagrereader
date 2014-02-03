package eagre.reader.server.homecells;

import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.ServletContext;

import swarm.server.account.UserSession;
import swarm.server.app.ServerContext;
import swarm.server.blobxn.BlobTransaction_AddCellToUser;
import swarm.server.blobxn.BlobTransaction_CreateCell;
import swarm.server.blobxn.BlobTransaction_SetCellAddress;
import swarm.server.blobxn.BlobTransaction_SetCellPrivileges;
import swarm.server.data.blob.BlobException;
import swarm.server.data.blob.E_BlobCacheLevel;
import swarm.server.data.blob.E_BlobTransactionType;
import swarm.server.data.blob.I_BlobManager;
import swarm.server.entities.E_GridType;
import swarm.server.entities.ServerCell;
import swarm.server.entities.ServerUser;
import swarm.server.handlers.U_CellCode;
import swarm.server.handlers.admin.I_HomeCellCreator;
import swarm.server.structs.ServerCellAddress;
import swarm.server.structs.ServerCellAddressMapping;
import swarm.server.structs.ServerCode;
import swarm.server.structs.ServerCodePrivileges;
import swarm.server.transaction.TransactionContext;
import swarm.shared.app.S_CommonApp;
import swarm.shared.code.CompilerResult;
import swarm.shared.code.E_CompilationStatus;
import swarm.shared.entities.E_CharacterQuota;
import swarm.shared.entities.E_CodeType;
import swarm.shared.structs.CodePrivileges;
import swarm.shared.structs.E_NetworkPrivilege;
import swarm.shared.structs.GridCoordinate;
import swarm.shared.transaction.E_ResponseError;
import swarm.shared.transaction.TransactionRequest;
import swarm.shared.transaction.TransactionResponse;

public class PrototypeCellCreator implements I_HomeCellCreator
{
	private static Logger s_logger = Logger.getLogger(PrototypeCellCreator.class.getName());
	
	private enum Book
	{
		ExploringGeology(173, 7, 5),
		ExploringGeography(180, 13, 3);
		
		private final int m_startImageIndex;
		private final int m_pageCount;
		private final int m_chapter;
		
		private Book(int startImageIndex, int pageCount, int chapter)
		{
			m_startImageIndex = startImageIndex;
			m_pageCount = pageCount;
			m_chapter = chapter;
		}
		
		public int getStartImageIndex()
		{
			return m_startImageIndex;
		}
		
		public int getPageCount()
		{
			return m_pageCount;
		}
		
		public int getChapter()
		{
			return m_chapter;
		}
	};
	
	private ServerContext m_serverContext;
	
	@Override
	public void initialize(ServerContext serverContext, ServletContext servletContext)
	{
		m_serverContext = serverContext;
	}
	
	private boolean createCell(Book book, int page, I_BlobManager blobManager, ServerCodePrivileges privileges, TransactionResponse response)
	{
		int pageIndex = page - 1;
		
		GridCoordinate coordinate = new GridCoordinate(pageIndex, book.ordinal());
		ServerCellAddressMapping mapping = new ServerCellAddressMapping(E_GridType.ACTIVE, coordinate);
		
		ServerCellAddress pageAddress = new ServerCellAddress(book.name()+"/Page"+(pageIndex+100));
		ServerCellAddress[] addresses;
		
		if( pageIndex == 0 )
		{
			ServerCellAddress chapterAddress = new ServerCellAddress(book.name()+"/Chapter"+book.getChapter());
			ServerCellAddress bookAddress = new ServerCellAddress(book.name());
			
			addresses = new ServerCellAddress[3];
			addresses[0] = pageAddress;
			addresses[1] = chapterAddress;
			addresses[2] = bookAddress;
		}
		else
		{
			addresses = new ServerCellAddress[1];
			addresses[0] = pageAddress;
		}
		
		if( U_CellCode.getCell(blobManager, mapping, response) == null )
		{
			BlobTransaction_CreateCell createCellTxn = new BlobTransaction_CreateCell(addresses, coordinate, privileges, 1);
			
			try
			{
				createCellTxn.perform(m_serverContext.blobMngrFactory, E_BlobTransactionType.MULTI_BLOB_TYPE, 1);
			}
			catch (BlobException e)
			{
				response.setError(E_ResponseError.SERVER_EXCEPTION);
				
				return false;
			}
		}
		else
		{
			BlobTransaction_SetCellAddress setCellAddyTxn = new BlobTransaction_SetCellAddress(mapping, addresses);
			
			try
			{
				setCellAddyTxn.perform(m_serverContext.blobMngrFactory, E_BlobTransactionType.MULTI_BLOB_TYPE, 1);
			}
			catch (BlobException e)
			{
				response.setError(E_ResponseError.SERVER_EXCEPTION);
				
				return false;
			}
			
		}
	
		//--- DRK > Get the source code for the cell.
		String image = "/r.img/pages/IMG_0"+ (book.getStartImageIndex()+pageIndex)+".jpg";
		String code = "<html><head></head><body style='position:absolute; width:100%; height:100%; overflow:hidden;'><img src='"+image+"'/></body></html>";
		ServerCode sourceCode = new ServerCode(code, E_CodeType.SOURCE);
		
		//--- DRK > Get the cell itself.
		ServerCell persistedCell = U_CellCode.getCellForCompile(blobManager, mapping, response);
	
		if( persistedCell == null )  return false;
		
		CompilerResult result = U_CellCode.compileCell(m_serverContext.codeCompiler, persistedCell, sourceCode, mapping, m_serverContext.config.appId);
		
		if( result.getStatus() != E_CompilationStatus.NO_ERROR )
		{
			s_logger.severe("Couldn't compile source code: ");
			
			response.setError(E_ResponseError.SERVICE_EXCEPTION);
			
			return false;
		}

		I_BlobManager cachingBlobMngr = m_serverContext.blobMngrFactory.create(E_BlobCacheLevel.MEMCACHE);
		
		if( !U_CellCode.saveBackCompiledCell(blobManager, cachingBlobMngr, mapping, persistedCell, response) )
		{
			response.setError(E_ResponseError.SERVICE_EXCEPTION);
			
			return false;
		}
		
		return true;
	}

	@Override
	public void run(TransactionRequest request, TransactionResponse response, TransactionContext context, UserSession session, ServerUser user)
	{
		ServerCodePrivileges privileges = new ServerCodePrivileges();
		privileges.setNetworkPrivilege(E_NetworkPrivilege.ALL);
		privileges.setCharacterQuota(E_CharacterQuota.TIER_1);
		
		I_BlobManager blobManager = m_serverContext.blobMngrFactory.create(E_BlobCacheLevel.LOCAL, E_BlobCacheLevel.PERSISTENT);
		
		for( int i = 0; i < Book.values().length; i++ )
		{
			Book book = Book.values()[i];
			
			for( int j = 0; j < book.getPageCount(); j++ )
			{
				this.createCell(book, j+1, blobManager, privileges, response);
			}
		}
	}
}
