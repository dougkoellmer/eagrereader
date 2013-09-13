package eagre.reader.server.homecells;

import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.ServletContext;

import swarm.server.account.smUserSession;
import swarm.server.app.smServerContext;
import swarm.server.blobxn.smBlobTransaction_AddCellToUser;
import swarm.server.blobxn.smBlobTransaction_CreateCell;
import swarm.server.blobxn.smBlobTransaction_SetCellAddress;
import swarm.server.blobxn.smBlobTransaction_SetCellPrivileges;
import swarm.server.data.blob.smBlobException;
import swarm.server.data.blob.smE_BlobCacheLevel;
import swarm.server.data.blob.smE_BlobTransactionType;
import swarm.server.data.blob.smI_BlobManager;
import swarm.server.entities.smE_GridType;
import swarm.server.entities.smServerCell;
import swarm.server.entities.smServerUser;
import swarm.server.handlers.smU_CellCode;
import swarm.server.handlers.admin.smI_HomeCellCreator;
import swarm.server.structs.smServerCellAddress;
import swarm.server.structs.smServerCellAddressMapping;
import swarm.server.structs.smServerCode;
import swarm.server.structs.smServerCodePrivileges;
import swarm.server.transaction.smTransactionContext;
import swarm.shared.app.smS_App;
import swarm.shared.code.smCompilerResult;
import swarm.shared.code.smE_CompilationStatus;
import swarm.shared.entities.smE_CharacterQuota;
import swarm.shared.entities.smE_CodeType;
import swarm.shared.structs.smCodePrivileges;
import swarm.shared.structs.smE_NetworkPrivilege;
import swarm.shared.structs.smGridCoordinate;
import swarm.shared.transaction.smE_ResponseError;
import swarm.shared.transaction.smTransactionRequest;
import swarm.shared.transaction.smTransactionResponse;

public class PrototypeCellCreator implements smI_HomeCellCreator
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
	
	private smServerContext m_serverContext;
	
	@Override
	public void initialize(smServerContext serverContext, ServletContext servletContext)
	{
		m_serverContext = serverContext;
	}
	
	private boolean createCell(Book book, int page, smI_BlobManager blobManager, smServerCodePrivileges privileges, smTransactionResponse response)
	{
		int pageIndex = page - 1;
		
		smGridCoordinate coordinate = new smGridCoordinate(pageIndex, book.ordinal());
		smServerCellAddressMapping mapping = new smServerCellAddressMapping(smE_GridType.ACTIVE, coordinate);
		
		smServerCellAddress pageAddress = new smServerCellAddress(book.name()+"/Page"+(pageIndex+100));
		smServerCellAddress[] addresses;
		
		if( pageIndex == 0 )
		{
			smServerCellAddress chapterAddress = new smServerCellAddress(book.name()+"/Chapter"+book.getChapter());
			smServerCellAddress bookAddress = new smServerCellAddress(book.name());
			
			addresses = new smServerCellAddress[3];
			addresses[0] = pageAddress;
			addresses[1] = chapterAddress;
			addresses[2] = bookAddress;
		}
		else
		{
			addresses = new smServerCellAddress[1];
			addresses[0] = pageAddress;
		}
		
		if( smU_CellCode.getCell(blobManager, mapping, response) == null )
		{
			smBlobTransaction_CreateCell createCellTxn = new smBlobTransaction_CreateCell(addresses, coordinate, privileges, 1);
			
			try
			{
				createCellTxn.perform(m_serverContext.blobMngrFactory, smE_BlobTransactionType.MULTI_BLOB_TYPE, 1);
			}
			catch (smBlobException e)
			{
				response.setError(smE_ResponseError.SERVER_EXCEPTION);
				
				return false;
			}
		}
		else
		{
			smBlobTransaction_SetCellAddress setCellAddyTxn = new smBlobTransaction_SetCellAddress(mapping, addresses);
			
			try
			{
				setCellAddyTxn.perform(m_serverContext.blobMngrFactory, smE_BlobTransactionType.MULTI_BLOB_TYPE, 1);
			}
			catch (smBlobException e)
			{
				response.setError(smE_ResponseError.SERVER_EXCEPTION);
				
				return false;
			}
			
		}
	
		//--- DRK > Get the source code for the cell.
		String image = "/r.img/pages/IMG_0"+ (book.getStartImageIndex()+pageIndex)+".jpg";
		String code = "<html><head></head><body style='position:absolute; width:100%; height:100%; overflow:hidden;'><img src='"+image+"'/></body></html>";
		smServerCode sourceCode = new smServerCode(code, smE_CodeType.SOURCE);
		
		//--- DRK > Get the cell itself.
		smServerCell persistedCell = smU_CellCode.getCellForCompile(blobManager, mapping, response);
	
		if( persistedCell == null )  return false;
		
		smCompilerResult result = smU_CellCode.compileCell(m_serverContext.codeCompiler, persistedCell, sourceCode, mapping, m_serverContext.config.appId);
		
		if( result.getStatus() != smE_CompilationStatus.NO_ERROR )
		{
			s_logger.severe("Couldn't compile source code: ");
			
			response.setError(smE_ResponseError.SERVICE_EXCEPTION);
			
			return false;
		}

		smI_BlobManager cachingBlobMngr = m_serverContext.blobMngrFactory.create(smE_BlobCacheLevel.MEMCACHE);
		
		if( !smU_CellCode.saveBackCompiledCell(blobManager, cachingBlobMngr, mapping, persistedCell, response) )
		{
			response.setError(smE_ResponseError.SERVICE_EXCEPTION);
			
			return false;
		}
		
		return true;
	}

	@Override
	public void run(smTransactionRequest request, smTransactionResponse response, smTransactionContext context, smUserSession session, smServerUser user)
	{
		smServerCodePrivileges privileges = new smServerCodePrivileges();
		privileges.setNetworkPrivilege(smE_NetworkPrivilege.ALL);
		privileges.setCharacterQuota(smE_CharacterQuota.TIER_1);
		
		smI_BlobManager blobManager = m_serverContext.blobMngrFactory.create(smE_BlobCacheLevel.LOCAL, smE_BlobCacheLevel.PERSISTENT);
		
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
